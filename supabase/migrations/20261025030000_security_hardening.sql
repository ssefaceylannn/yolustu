-- Güvenlik sertleştirmesi (iç denetim bulguları)

-- ---------------------------------------------------------------------------
-- 1) Yakındaki yolcular: konum ve engelleme üzerinden kişi bulma açığı kapatılır.
--    - Sayım ve yayın, isteyenin kendi (2 km ızgaralı) varlık hücresinden yapılır.
--    - Sayıma engellenenler de dahildir (engelle/kaldır farkıyla kimin nerede olduğu anlaşılamaz);
--      engellenenler sadece mesaj teslimatında dışarıda kalır.
--    - Yarıçap en az 10 km; konum değiştirme ve sayım sıklığı sınırlı.
-- ---------------------------------------------------------------------------

alter table public.presence add column if not exists moved_at timestamptz not null default now();

create or replace function public.update_presence(p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); cur record; newcell geography;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null or p_lat not between 34 and 44 or p_lng not between 24 and 46 then raise exception 'outside_turkey'; end if;
  if not coalesce((select visible_nearby from profile_private where id = uid), false) then
    delete from presence where user_id = uid;
    return;
  end if;
  newcell := snap_cell(p_lat, p_lng);
  select * into cur from presence where user_id = uid;
  if found and not ST_Equals(cur.cell::geometry, newcell::geometry) and cur.moved_at > now() - interval '10 minutes' then
    -- Kısa sürede çok uzağa "ışınlanma" yok: sadece süreyi uzat
    update presence set expires_at = now() + interval '6 hours' where user_id = uid;
    return;
  end if;
  insert into presence (user_id, cell, expires_at, moved_at) values (uid, newcell, now() + interval '6 hours', now())
  on conflict (user_id) do update set
    moved_at = case when ST_Equals(presence.cell::geometry, excluded.cell::geometry) then presence.moved_at else now() end,
    cell = excluded.cell, expires_at = excluded.expires_at;
end $$;

drop function if exists public.nearby_candidates(uuid, double precision, double precision, int);
create or replace function public.nearby_candidates(uid uuid, p_radius_km int)
returns table (user_id uuid, blocked boolean)
language sql stable security definer set search_path = public, extensions as $$
  with me as (select cell from presence where presence.user_id = uid and expires_at > now())
  select pr.user_id, is_blocked_between(uid, pr.user_id)
  from presence pr, me
  where pr.user_id <> uid
    and pr.expires_at > now()
    and ST_DWithin(pr.cell, me.cell, least(greatest(p_radius_km, 10), 50) * 1000)
  order by ST_Distance(pr.cell, me.cell), random()
  limit 10;
$$;
revoke all on function public.nearby_candidates(uuid, int) from public, anon, authenticated;

-- İmza istemciyle uyum için korunur; koordinat parametreleri artık kullanılmaz.
create or replace function public.nearby_count(p_lat double precision, p_lng double precision, p_radius_km int default 25) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return 0; end if;
  if not consume_api_quota(uid, 'nearby', 120) then raise exception 'rate_limited'; end if;
  return (select count(*)::int from nearby_candidates(uid, p_radius_km));
end $$;

create or replace function public.send_broadcast(p_lat double precision, p_lng double precision, p_body text, p_radius_km int default 25)
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  bid uuid;
  total int;
  account_age interval;
  daily_limit int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended('broadcast:' || uid::text, 0));
  if not public.is_clean(p_body) then raise exception 'inappropriate_content'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'empty'; end if;
  if not exists (select 1 from presence where user_id = uid and expires_at > now()) then raise exception 'not_visible'; end if;
  select now() - created_at into account_age from auth.users where id = uid;
  daily_limit := case when account_age < interval '1 day' then 1 else 3 end;
  if (select count(*) from broadcasts where sender_id = uid and created_at > now() - interval '1 day') >= daily_limit then
    raise exception 'rate_limited';
  end if;
  insert into broadcasts (sender_id, body) values (uid, trim(p_body)) returning id into bid;
  create temp table if not exists _cand (user_id uuid, blocked boolean) on commit drop;
  delete from _cand;
  insert into _cand select * from nearby_candidates(uid, p_radius_km);
  select count(*) into total from _cand;
  insert into broadcast_recipients (broadcast_id, recipient_id) select bid, c.user_id from _cand c where not c.blocked;
  update broadcasts set recipient_count = total where id = bid;
  return total;
end $$;

-- is_blocked_between: RLS politikaları çağıran rolün yetkisiyle çalıştırdığı için yetki kalır.

-- ---------------------------------------------------------------------------
-- 2) Yorum: şikâyetle gizlenen yorum yazarı tarafından geri açılamaz; sadece puan/metin değişir.
-- ---------------------------------------------------------------------------
drop policy if exists reviews_update on public.place_reviews;
create policy reviews_update on public.place_reviews for update to authenticated
  using (user_id = auth.uid() and status = 'active')
  with check (user_id = auth.uid() and status = 'active' and public.is_clean(body));
revoke update on public.place_reviews from authenticated;
grant update (rating, body) on public.place_reviews to authenticated;

-- Sadece okundu / gizle alanları güncellenebilir
revoke update on public.broadcast_recipients from authenticated;
grant update (dismissed) on public.broadcast_recipients to authenticated;
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Check-in'ler: zaman damgalı konum geçmişi sayıldığı için sadece sahibi okur.
-- ---------------------------------------------------------------------------
drop policy if exists checkins_read on public.checkins;
create policy checkins_read on public.checkins for select to authenticated using (user_id = auth.uid());

create or replace function public.check_in(p_place bigint, p_lat double precision, p_lng double precision)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  pl record;
  dist double precision;
  is_first_v boolean;
  new_badges text[];
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null then raise exception 'location_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('checkin:' || uid::text, 0));
  select id, geom into pl from places where id = p_place and status = 'active';
  if not found then raise exception 'place_not_found'; end if;
  dist := ST_Distance(pl.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography);
  if dist is null or dist > 150 then
    return jsonb_build_object('ok', false, 'reason', 'too_far', 'distance_m', round(coalesce(dist, 0)));
  end if;
  if exists (select 1 from checkins where user_id = uid and place_id = p_place and created_at > now() - interval '12 hours') then
    return jsonb_build_object('ok', false, 'reason', 'already_checked_in');
  end if;
  if (select count(*) from checkins where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate_limited';
  end if;
  is_first_v := not exists (select 1 from checkins where place_id = p_place);
  insert into checkins (user_id, place_id, is_first) values (uid, p_place, is_first_v);
  perform refresh_place_stats(p_place);
  select coalesce(array_agg(b), '{}') into new_badges from evaluate_badges(uid) b;
  return jsonb_build_object('ok', true, 'first', is_first_v, 'new_badges', to_jsonb(new_badges));
end $$;

-- ---------------------------------------------------------------------------
-- 4) Şikâyet: yeni açılmış hesaplarla toplu gizleme yapılamaz; günlük sınır.
-- ---------------------------------------------------------------------------
create or replace function public.before_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;
  return new;
end $$;
drop trigger if exists reports_before on public.reports;
create trigger reports_before before insert on public.reports for each row execute function public.before_report();

create or replace function public.after_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- Sadece en az 3 günlük hesapların şikâyetleri otomatik gizlemeye sayılır
  select count(*) into n from reports r join auth.users u on u.id = r.reporter_id
  where r.target_type = new.target_type and r.target_id = new.target_id and r.status = 'open'
    and u.created_at < now() - interval '3 days';
  if n >= 3 then
    if new.target_type = 'place' then update places set status = 'hidden' where id::text = new.target_id and source = 'user';
    elsif new.target_type = 'review' then update place_reviews set status = 'hidden' where id::text = new.target_id;
    elsif new.target_type = 'photo' then update place_photos set status = 'hidden' where id::text = new.target_id;
    end if;
  end if;
  return null;
end $$;
revoke execute on function public.before_report() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Fotoğraf yolları: sadece kendi klasörü, beklenen biçim; sahibi gizlenmiş fotoğrafını da görür.
-- ---------------------------------------------------------------------------
drop policy if exists photos_insert on public.place_photos;
create policy photos_insert on public.place_photos for insert to authenticated
  with check (user_id = auth.uid() and status = 'active'
    and path ~ ('^' || auth.uid()::text || '/[0-9]+/[0-9a-fA-F-]{36}\.jpg$')
    and split_part(path, '/', 2) = place_id::text);
drop policy if exists photos_read on public.place_photos;
create policy photos_read on public.place_photos for select to anon, authenticated using (status = 'active' or user_id = auth.uid());

-- Profil fotoğrafı sadece kendi klasöründen
create or replace function public.profiles_guard_avatar() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.avatar_path is not null and new.avatar_path !~ ('^' || new.id::text || '/[0-9a-fA-F-]{36}\.jpg$') then
    raise exception 'invalid_avatar_path';
  end if;
  return new;
end $$;
drop trigger if exists profiles_avatar_guard on public.profiles;
create trigger profiles_avatar_guard before insert or update of avatar_path on public.profiles
  for each row execute function public.profiles_guard_avatar();

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists media_update_own on storage.objects';
    execute $p$create policy media_update_own on storage.objects for update to authenticated
      using (bucket_id in ('place-photos','avatars') and owner_id = auth.uid()::text)
      with check (bucket_id in ('place-photos','avatars') and owner_id = auth.uid()::text and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;

-- Hesap silme için (sadece sunucu fonksiyonu): kullanıcının tüm dosyaları
create or replace function public.user_storage_objects(p_user uuid)
returns table (bucket_id text, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query select o.bucket_id::text, o.name::text from storage.objects o
  where o.bucket_id in ('place-photos','avatars')
    and (o.owner_id = p_user::text or o.name like p_user::text || '/%');
end $$;
revoke execute on function public.user_storage_objects(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Yer ekleme: etiket değerleri doğrulanır; eşzamanlı isteklerle sınır aşılamaz.
-- ---------------------------------------------------------------------------
create or replace function public.add_place(p_category text, p_name text, p_description text, p_lat double precision, p_lng double precision, p_tags jsonb default '{}'::jsonb)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  new_id bigint;
  clean_tags jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended('add_place:' || uid::text, 0));
  if (select count(*) from places where created_by = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;
  if not (public.is_clean(p_name) and public.is_clean(p_description)) then raise exception 'inappropriate_content'; end if;
  if char_length(coalesce(p_name, '')) > 120 or char_length(coalesce(p_description, '')) > 1000 then raise exception 'too_long'; end if;
  if p_lat is null or p_lng is null or p_lat not between 35 and 43 or p_lng not between 25 and 45.5 then raise exception 'outside_turkey'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into clean_tags
  from jsonb_each(case when jsonb_typeof(p_tags) = 'object' then p_tags else '{}'::jsonb end)
  where key in ('electricity','water','shower','toilet','fee','wifi','dogs','sea_view','shade','fire','phone','website')
    and jsonb_typeof(value) = 'string'
    and char_length(value #>> '{}') <= 200
    and case key
          when 'website' then (value #>> '{}') ~ '^https?://[^\s<>"]+$'
          when 'phone' then (value #>> '{}') ~ '^[0-9+ ()-]{3,30}$'
          else (value #>> '{}') in ('yes', 'no')
        end;
  insert into places (source, category, name, description, tags, geom, created_by)
  values ('user', p_category, nullif(trim(p_name), ''), nullif(trim(p_description), ''), clean_tags,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, uid)
  returning id into new_id;
  perform evaluate_badges(uid);
  return new_id;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Kayıt: meta verideki kullanıcı adı / görünen ad da uygunsuz içerik denetiminden geçer.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; candidate text; i int := 0; dname text;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', ''), '[^a-zA-Z0-9_.]', '', 'g'));
  if base = '' or not public.is_clean(base) then base := 'yolcu' || (floor(random() * 900000) + 100000)::int; end if;
  if char_length(base) < 3 then base := 'yolcu' || base; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    i := i + 1;
    candidate := base || (floor(random() * 9000) + 1000)::int;
    exit when i > 20;
  end loop;
  dname := nullif(left(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), 40), '');
  if dname is not null and not public.is_clean(dname) then dname := null; end if;
  insert into profiles (id, username, display_name) values (new.id, candidate, dname);
  insert into profile_private (id, locale) values (new.id, case when new.raw_user_meta_data->>'locale' = 'en' then 'en' else 'tr' end);
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 8) Konum paylaşımı: engelleme sonrası eski paylaşım da görünmez.
-- ---------------------------------------------------------------------------
create or replace function public.get_location_share(p_conversation uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c record; mine record; theirs record;
begin
  select * into c from conversations where id = p_conversation and uid in (user_a, user_b);
  if not found then raise exception 'not_found'; end if;
  if is_blocked_between(c.user_a, c.user_b) then return jsonb_build_object('status','none'); end if;
  select * into mine from location_shares where conversation_id = p_conversation and user_id = uid and created_at > now() - interval '24 hours';
  select * into theirs from location_shares where conversation_id = p_conversation and user_id <> uid and created_at > now() - interval '24 hours';
  if mine.user_id is not null and theirs.user_id is not null and abs(extract(epoch from mine.created_at - theirs.created_at)) <= 1800 then
    return jsonb_build_object('status','complete',
      'mine', jsonb_build_object('lat', mine.lat, 'lng', mine.lng, 'at', mine.created_at),
      'theirs', jsonb_build_object('lat', theirs.lat, 'lng', theirs.lng, 'at', theirs.created_at));
  elsif mine.user_id is not null then
    return jsonb_build_object('status','waiting_them','since', mine.created_at);
  elsif theirs.user_id is not null and theirs.created_at > now() - interval '30 minutes' then
    return jsonb_build_object('status','waiting_me','since', theirs.created_at);
  end if;
  return jsonb_build_object('status','none');
end $$;

-- ---------------------------------------------------------------------------
-- 9) Veri dışa aktarma (KVKK md. 11): eksik kişisel veriler eklendi.
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', id, 'email', email, 'created_at', created_at) from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from profiles p where id = auth.uid()),
    'settings', (select to_jsonb(p) from profile_private p where id = auth.uid()),
    'vehicles', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from vehicles v where user_id = auth.uid()),
    'checkins', (select coalesce(jsonb_agg(jsonb_build_object('place_id', place_id, 'at', created_at)), '[]') from checkins where user_id = auth.uid()),
    'badges', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from user_badges b where user_id = auth.uid()),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from place_reviews r where user_id = auth.uid()),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('place_id', place_id, 'path', path, 'status', status, 'at', created_at)), '[]') from place_photos where user_id = auth.uid()),
    'places_added', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'category', category, 'at', created_at)), '[]') from places where created_by = auth.uid()),
    'checklist', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from checklist_items c where user_id = auth.uid()),
    'presence', (select jsonb_build_object('cell', ST_AsGeoJSON(cell::geometry)::jsonb, 'expires_at', expires_at) from presence where user_id = auth.uid()),
    'broadcasts_sent', (select coalesce(jsonb_agg(jsonb_build_object('body', body, 'recipients', recipient_count, 'at', created_at)), '[]') from broadcasts where sender_id = auth.uid()),
    'broadcasts_received', (select coalesce(jsonb_agg(jsonb_build_object('broadcast_id', broadcast_id, 'replied', replied, 'dismissed', dismissed, 'at', created_at)), '[]') from broadcast_recipients where recipient_id = auth.uid()),
    'conversations', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at)), '[]') from conversations where auth.uid() in (user_a, user_b)),
    'messages_sent', (select coalesce(jsonb_agg(jsonb_build_object('conversation_id', conversation_id, 'body', body, 'at', created_at)), '[]') from messages where sender_id = auth.uid()),
    'messages_received', (select coalesce(jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'from', m.sender_id, 'body', m.body, 'at', m.created_at)), '[]')
                          from messages m join conversations c on c.id = m.conversation_id
                          where auth.uid() in (c.user_a, c.user_b) and m.sender_id <> auth.uid()),
    'location_shares', (select coalesce(jsonb_agg(jsonb_build_object('conversation_id', conversation_id, 'lat', lat, 'lng', lng, 'at', created_at)), '[]') from location_shares where user_id = auth.uid()),
    'reports_filed', (select coalesce(jsonb_agg(jsonb_build_object('type', target_type, 'target', target_id, 'reason', reason, 'at', created_at)), '[]') from reports where reporter_id = auth.uid()),
    'donations', (select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'product', product_id, 'at', created_at)), '[]') from donations where user_id = auth.uid()),
    'blocks', (select coalesce(jsonb_agg(blocked_id), '[]') from blocks where blocker_id = auth.uid())
  );
$$;
