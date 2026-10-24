-- Yolüstü veritabanı şeması
-- Kural: istemci tablolara sadece RLS izin verdiği kadar erişir; hassas işlemler
-- SECURITY DEFINER fonksiyonlarla (RPC) ve sunucu tarafı doğrulamayla yapılır.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Basit küfür/hakaret filtresi (Türkçe + İngilizce). Kelime sınırına bakar.
create or replace function public.is_clean(t text) returns boolean
language sql immutable as $$
  select t is null or not (
    lower(t) ~ '(^|[^a-zçğıöşü])(amk|aq|amq|orospu|oç|piç|siktir|sikerim|sikeyim|yarrak|yarak|göt|götveren|pezevenk|kahpe|ibne|amcık|ananı|anani|fuck|fucking|shit|bitch|cunt|whore|faggot|nigger)([^a-zçğıöşü]|$)'
  )
$$;

-- ---------------------------------------------------------------------------
-- İller (bölge eşlemesi burada, sınır geometrisi içe aktarma ile dolar)
-- ---------------------------------------------------------------------------

create table public.provinces (
  code smallint primary key,
  name text not null,
  region text not null check (region in ('marmara','ege','akdeniz','ic_anadolu','karadeniz','dogu_anadolu','guneydogu')),
  geom extensions.geography(MultiPolygon, 4326),
  geom_simple jsonb
);
create index provinces_geom_idx on public.provinces using gist (geom);

insert into public.provinces (code, name, region) values
(1,'Adana','akdeniz'),(2,'Adıyaman','guneydogu'),(3,'Afyonkarahisar','ege'),(4,'Ağrı','dogu_anadolu'),
(5,'Amasya','karadeniz'),(6,'Ankara','ic_anadolu'),(7,'Antalya','akdeniz'),(8,'Artvin','karadeniz'),
(9,'Aydın','ege'),(10,'Balıkesir','marmara'),(11,'Bilecik','marmara'),(12,'Bingöl','dogu_anadolu'),
(13,'Bitlis','dogu_anadolu'),(14,'Bolu','karadeniz'),(15,'Burdur','akdeniz'),(16,'Bursa','marmara'),
(17,'Çanakkale','marmara'),(18,'Çankırı','ic_anadolu'),(19,'Çorum','karadeniz'),(20,'Denizli','ege'),
(21,'Diyarbakır','guneydogu'),(22,'Edirne','marmara'),(23,'Elazığ','dogu_anadolu'),(24,'Erzincan','dogu_anadolu'),
(25,'Erzurum','dogu_anadolu'),(26,'Eskişehir','ic_anadolu'),(27,'Gaziantep','guneydogu'),(28,'Giresun','karadeniz'),
(29,'Gümüşhane','karadeniz'),(30,'Hakkari','dogu_anadolu'),(31,'Hatay','akdeniz'),(32,'Isparta','akdeniz'),
(33,'Mersin','akdeniz'),(34,'İstanbul','marmara'),(35,'İzmir','ege'),(36,'Kars','dogu_anadolu'),
(37,'Kastamonu','karadeniz'),(38,'Kayseri','ic_anadolu'),(39,'Kırklareli','marmara'),(40,'Kırşehir','ic_anadolu'),
(41,'Kocaeli','marmara'),(42,'Konya','ic_anadolu'),(43,'Kütahya','ege'),(44,'Malatya','dogu_anadolu'),
(45,'Manisa','ege'),(46,'Kahramanmaraş','akdeniz'),(47,'Mardin','guneydogu'),(48,'Muğla','ege'),
(49,'Muş','dogu_anadolu'),(50,'Nevşehir','ic_anadolu'),(51,'Niğde','ic_anadolu'),(52,'Ordu','karadeniz'),
(53,'Rize','karadeniz'),(54,'Sakarya','marmara'),(55,'Samsun','karadeniz'),(56,'Siirt','guneydogu'),
(57,'Sinop','karadeniz'),(58,'Sivas','ic_anadolu'),(59,'Tekirdağ','marmara'),(60,'Tokat','karadeniz'),
(61,'Trabzon','karadeniz'),(62,'Tunceli','dogu_anadolu'),(63,'Şanlıurfa','guneydogu'),(64,'Uşak','ege'),
(65,'Van','dogu_anadolu'),(66,'Yozgat','ic_anadolu'),(67,'Zonguldak','karadeniz'),(68,'Aksaray','ic_anadolu'),
(69,'Bayburt','karadeniz'),(70,'Karaman','ic_anadolu'),(71,'Kırıkkale','ic_anadolu'),(72,'Batman','guneydogu'),
(73,'Şırnak','guneydogu'),(74,'Bartın','karadeniz'),(75,'Ardahan','dogu_anadolu'),(76,'Iğdır','dogu_anadolu'),
(77,'Yalova','marmara'),(78,'Karabük','karadeniz'),(79,'Kilis','guneydogu'),(80,'Osmaniye','akdeniz'),
(81,'Düzce','karadeniz');

alter table public.provinces enable row level security;
create policy provinces_read on public.provinces for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Profiller
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text check (char_length(display_name) <= 40),
  bio text check (char_length(bio) <= 280),
  avatar_path text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
-- Kullanıcı adı ve görünen ad herkese (giriş yapmış) açık; mesajlaşma için gerekli.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and public.is_clean(username) and public.is_clean(display_name) and public.is_clean(bio));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and public.is_clean(username) and public.is_clean(display_name) and public.is_clean(bio));

-- Özel ayarlar: sadece sahibi görür.
create table public.profile_private (
  id uuid primary key references auth.users (id) on delete cascade,
  locale text not null default 'tr' check (locale in ('tr','en')),
  visible_nearby boolean not null default false,
  terms_accepted_at timestamptz,
  privacy_ack_at timestamptz,
  nearby_consent_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger profile_private_touch before update on public.profile_private for each row execute function public.touch_updated_at();
alter table public.profile_private enable row level security;
create policy profile_private_own on public.profile_private for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Araçlar (sadece sahibi görür)
-- ---------------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('motorhome','caravan','van','car','suv','pickup','motorcycle','other')),
  brand text check (char_length(brand) <= 40),
  model text check (char_length(model) <= 60),
  year smallint check (year between 1950 and 2100),
  fuel text check (fuel in ('diesel','petrol','lpg','hybrid','electric')),
  gearbox text check (gearbox in ('manual','automatic')),
  length_cm smallint check (length_cm between 100 and 2500),
  height_cm smallint check (height_cm between 50 and 500),
  weight_kg integer check (weight_kg between 50 and 40000),
  tows_caravan boolean not null default false,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_user_idx on public.vehicles (user_id);
create trigger vehicles_touch before update on public.vehicles for each row execute function public.touch_updated_at();
alter table public.vehicles enable row level security;
create policy vehicles_own on public.vehicles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Yerler
-- ---------------------------------------------------------------------------

create table public.places (
  id bigint generated always as identity primary key,
  source text not null default 'user' check (source in ('osm','user')),
  osm_type text check (osm_type in ('node','way','relation')),
  osm_id bigint,
  category text not null check (category in (
    'campsite','caravan_site','wild_camp','picnic','water','toilet','shower','dump_station',
    'fuel','lpg','ev_charging','repair','tyres','car_dealer',
    'viewpoint','beach','lake','waterfall','peak','spring','cave','attraction','historic')),
  name text check (char_length(name) <= 120),
  description text check (char_length(description) <= 1000),
  tags jsonb not null default '{}'::jsonb,
  geom extensions.geography(Point, 4326) not null,
  province_code smallint references public.provinces (code),
  status text not null default 'active' check (status in ('active','hidden')),
  created_by uuid references auth.users (id) on delete set null,
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  checkin_count integer not null default 0,
  photo_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (osm_type, osm_id)
);
create index places_geom_idx on public.places using gist (geom);
create index places_category_idx on public.places (category);
create index places_province_idx on public.places (province_code);
create trigger places_touch before update on public.places for each row execute function public.touch_updated_at();

-- İl bilgisini konumdan otomatik bul
create or replace function public.places_set_province() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.province_code is null or tg_op = 'UPDATE' and new.geom is distinct from old.geom then
    select p.code into new.province_code
    from public.provinces p
    where p.geom is not null and ST_Intersects(p.geom, new.geom)
    limit 1;
  end if;
  return new;
end $$;
create trigger places_province before insert or update of geom on public.places
  for each row execute function public.places_set_province();

alter table public.places enable row level security;
create policy places_read on public.places for select to anon, authenticated using (status = 'active');
-- Kullanıcının yer eklemesi sadece add_place() fonksiyonu ile.

-- ---------------------------------------------------------------------------
-- Yorumlar ve fotoğraflar
-- ---------------------------------------------------------------------------

create table public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id bigint not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1000),
  status text not null default 'active' check (status in ('active','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id)
);
create index place_reviews_place_idx on public.place_reviews (place_id, created_at desc);
create trigger place_reviews_touch before update on public.place_reviews for each row execute function public.touch_updated_at();
alter table public.place_reviews enable row level security;
create policy reviews_read on public.place_reviews for select to authenticated using (status = 'active' or user_id = auth.uid());
create policy reviews_insert on public.place_reviews for insert to authenticated
  with check (user_id = auth.uid() and status = 'active' and public.is_clean(body));
create policy reviews_update on public.place_reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'active' and public.is_clean(body));
create policy reviews_delete on public.place_reviews for delete to authenticated using (user_id = auth.uid());

create table public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id bigint not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  path text not null unique,
  width integer,
  height integer,
  status text not null default 'active' check (status in ('active','hidden')),
  created_at timestamptz not null default now()
);
create index place_photos_place_idx on public.place_photos (place_id, created_at desc);
alter table public.place_photos enable row level security;
create policy photos_read on public.place_photos for select to anon, authenticated using (status = 'active');
create policy photos_insert on public.place_photos for insert to authenticated
  with check (user_id = auth.uid() and status = 'active' and path like auth.uid()::text || '/%');
create policy photos_delete on public.place_photos for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Check-in ve rozetler
-- ---------------------------------------------------------------------------

-- Kesin koordinat SAKLANMAZ; sadece yer ve zaman.
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id bigint not null references public.places (id) on delete cascade,
  is_first boolean not null default false,
  created_at timestamptz not null default now()
);
create index checkins_user_idx on public.checkins (user_id, created_at);
create index checkins_place_idx on public.checkins (place_id);
alter table public.checkins enable row level security;
create policy checkins_read on public.checkins for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles pr where pr.id = checkins.user_id and pr.is_public)
);
-- Ekleme sadece check_in() ile.

-- Yer istatistiklerini güncel tut
create or replace function public.refresh_place_stats(p_place bigint) returns void
language sql security definer set search_path = public as $$
  update public.places set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.place_reviews where place_id = p_place and status = 'active'), 0),
    rating_count = (select count(*) from public.place_reviews where place_id = p_place and status = 'active'),
    photo_count = (select count(*) from public.place_photos where place_id = p_place and status = 'active'),
    checkin_count = (select count(*) from public.checkins where place_id = p_place)
  where id = p_place;
$$;


create table public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
create policy badges_read on public.user_badges for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles pr where pr.id = user_badges.user_id and pr.is_public)
);

-- Ardışık check-in'ler arası kuş uçuşu toplam km
create or replace function public.user_km(p_user uuid) returns integer
language sql stable security definer set search_path = public, extensions as $$
  with c as (
    select pl.geom, lag(pl.geom) over (order by ci.created_at) as prev
    from public.checkins ci join public.places pl on pl.id = ci.place_id
    where ci.user_id = p_user
  )
  select coalesce(round(sum(ST_Distance(geom, prev)) / 1000)::int, 0) from c where prev is not null;
$$;

create or replace function public.evaluate_badges(p_user uuid) returns setof text
language plpgsql security definer set search_path = public, extensions as $$
declare
  n_checkins int; n_prov int; n_pioneer int; n_nights int; n_reviews int; n_places int; n_photos int; km int;
  r record;
  earned text[] := '{}';
  b text;
begin
  select count(*) into n_checkins from checkins where user_id = p_user;
  select count(distinct pl.province_code) into n_prov from checkins c join places pl on pl.id = c.place_id
    where c.user_id = p_user and pl.province_code is not null;
  select count(*) into n_pioneer from checkins where user_id = p_user and is_first;
  select count(*) into n_nights from checkins c join places pl on pl.id = c.place_id
    where c.user_id = p_user and pl.category in ('campsite','caravan_site','wild_camp');
  select count(*) into n_reviews from place_reviews where user_id = p_user and status = 'active';
  select count(*) into n_places from places where created_by = p_user and status = 'active';
  select count(*) into n_photos from place_photos where user_id = p_user and status = 'active';
  km := public.user_km(p_user);

  if n_checkins >= 1 then earned := array_append(earned, 'first_step'::text); end if;
  foreach b in array array['10','50','100','250'] loop
    if n_checkins >= b::int then earned := array_append(earned, ('checkins_' || b)::text); end if;
  end loop;
  foreach b in array array['5','10','25','50','81'] loop
    if n_prov >= b::int then earned := array_append(earned, ('provinces_' || b)::text); end if;
  end loop;
  if n_pioneer >= 1 then earned := array_append(earned, 'pioneer_1'::text); end if;
  if n_pioneer >= 10 then earned := array_append(earned, 'pioneer_10'::text); end if;
  foreach b in array array['1','10','30','100'] loop
    if n_nights >= b::int then earned := array_append(earned, ('nights_' || b)::text); end if;
  end loop;
  foreach b in array array['1000','5000','10000','25000'] loop
    if km >= b::int then earned := array_append(earned, ('km_' || b)::text); end if;
  end loop;
  if n_reviews >= 10 then earned := array_append(earned, 'reviewer_10'::text); end if;
  if n_places >= 5 then earned := array_append(earned, 'mapper_5'::text); end if;
  if n_photos >= 20 then earned := array_append(earned, 'photographer_20'::text); end if;

  -- Doğa rozetleri
  for r in
    select pl.category, count(distinct pl.id) n from checkins c join places pl on pl.id = c.place_id
    where c.user_id = p_user and pl.category in ('beach','lake','peak','waterfall','cave')
    group by pl.category
  loop
    if (r.category = 'waterfall' and r.n >= 3) or (r.category <> 'waterfall' and r.n >= 5) then
      earned := array_append(earned, ('nature_' || r.category)::text);
    end if;
  end loop;

  -- Bölge rozetleri: bölgedeki tüm illerde en az bir check-in
  for r in
    select pv.region from provinces pv
    left join (
      select distinct pl.province_code from checkins c join places pl on pl.id = c.place_id where c.user_id = p_user
    ) v on v.province_code = pv.code
    group by pv.region
    having count(*) = count(v.province_code)
  loop
    earned := array_append(earned, ('region_' || r.region)::text);
  end loop;

  return query
  insert into user_badges (user_id, badge)
  select p_user, unnest(earned)
  on conflict do nothing
  returning badge;
end $$;
revoke all on function public.evaluate_badges(uuid) from public, anon, authenticated;

-- Check-in: kullanıcı yere 150 m'den yakın olmalı. Konum sadece doğrulama için kullanılır, saklanmaz.
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
  select id, geom into pl from places where id = p_place and status = 'active';
  if not found then raise exception 'place_not_found'; end if;
  dist := ST_Distance(pl.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography);
  if dist > 150 then
    return jsonb_build_object('ok', false, 'reason', 'too_far', 'distance_m', round(dist));
  end if;
  if exists (select 1 from checkins where user_id = uid and place_id = p_place and created_at > now() - interval '12 hours') then
    return jsonb_build_object('ok', false, 'reason', 'already_checked_in');
  end if;
  is_first_v := not exists (select 1 from checkins where place_id = p_place);
  insert into checkins (user_id, place_id, is_first) values (uid, p_place, is_first_v);
  perform refresh_place_stats(p_place);
  select coalesce(array_agg(b), '{}') into new_badges from evaluate_badges(uid) b;
  return jsonb_build_object('ok', true, 'first', is_first_v, 'new_badges', to_jsonb(new_badges));
end $$;

-- Yorum/fotoğraf değişince istatistik + rozet
create or replace function public.after_review_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_place_stats(coalesce(new.place_id, old.place_id));
  if tg_op <> 'DELETE' then perform evaluate_badges(new.user_id); end if;
  return null;
end $$;
create trigger place_reviews_after after insert or update or delete on public.place_reviews
  for each row execute function public.after_review_change();
create trigger place_photos_after after insert or update or delete on public.place_photos
  for each row execute function public.after_review_change();

-- Kullanıcı yer ekler (günde en fazla 20)
create or replace function public.add_place(p_category text, p_name text, p_description text, p_lat double precision, p_lng double precision, p_tags jsonb default '{}'::jsonb)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  new_id bigint;
  clean_tags jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if (select count(*) from places where created_by = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;
  if not (public.is_clean(p_name) and public.is_clean(p_description)) then raise exception 'inappropriate_content'; end if;
  if p_lat not between 35 and 43 or p_lng not between 25 and 45.5 then raise exception 'outside_turkey'; end if;
  -- Sadece bilinen etiketler
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into clean_tags
  from jsonb_each(coalesce(p_tags, '{}'::jsonb))
  where key in ('electricity','water','shower','toilet','fee','wifi','dogs','sea_view','shade','fire','phone','website');
  insert into places (source, category, name, description, tags, geom, created_by)
  values ('user', p_category, nullif(trim(p_name), ''), nullif(trim(p_description), ''), clean_tags,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, uid)
  returning id into new_id;
  perform evaluate_badges(uid);
  return new_id;
end $$;

-- Harita: görünen alandaki yerler
create or replace function public.places_in_bbox(
  min_lng double precision, min_lat double precision, max_lng double precision, max_lat double precision,
  p_categories text[] default null, p_filters text[] default null, p_limit int default 400)
returns table (id bigint, category text, name text, lat double precision, lng double precision, rating_avg numeric, rating_count int, tags jsonb)
language sql stable set search_path = public, extensions as $$
  select p.id, p.category, p.name, ST_Y(p.geom::geometry), ST_X(p.geom::geometry), p.rating_avg, p.rating_count, p.tags
  from places p
  where p.status = 'active'
    and p.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
    and (p_categories is null or p.category = any (p_categories))
    and (p_filters is null or not exists (
      select 1 from unnest(p_filters) f
      where not (case when f = 'free' then coalesce(p.tags ->> 'fee', '') = 'no'
                      else coalesce(p.tags ->> f, 'no') in ('yes','true') end)
    ))
  order by p.rating_count desc, p.checkin_count desc, p.id
  limit least(greatest(p_limit, 1), 800);
$$;

-- Rota üstündeki yerler. p_route: GeoJSON LineString. Sapma = gidiş-dönüş yaklaşık mesafe.
create or replace function public.places_along_route(p_route jsonb, p_buffer_m int default 5000, p_categories text[] default null, p_limit int default 150)
returns table (id bigint, category text, name text, lat double precision, lng double precision, rating_avg numeric, rating_count int,
               distance_from_route_m int, detour_m int, route_fraction double precision)
language sql stable set search_path = public, extensions as $$
  with r as (select ST_SetSRID(ST_GeomFromGeoJSON(p_route::text), 4326) as g)
  select p.id, p.category, p.name, ST_Y(p.geom::geometry), ST_X(p.geom::geometry), p.rating_avg, p.rating_count,
         round(ST_Distance(p.geom, r.g::geography))::int,
         round(ST_Distance(p.geom, r.g::geography) * 2 * 1.3)::int,
         ST_LineLocatePoint(r.g, p.geom::geometry)
  from places p, r
  where p.status = 'active'
    and ST_DWithin(p.geom, r.g::geography, least(greatest(p_buffer_m, 500), 30000))
    and (p_categories is null or p.category = any (p_categories))
  order by ST_LineLocatePoint(r.g, p.geom::geometry)
  limit least(greatest(p_limit, 1), 400);
$$;

-- Yakındaki servisler (araca göre). Marka eşleşen yetkili servisler öne çıkar.
create or replace function public.services_near(p_lat double precision, p_lng double precision, p_brand text default null, p_fuel text default null, p_radius_m int default 30000)
returns table (id bigint, category text, name text, lat double precision, lng double precision, distance_m int, brand_match boolean, tags jsonb)
language sql stable set search_path = public, extensions as $$
  with me as (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography g)
  select p.id, p.category, p.name, ST_Y(p.geom::geometry), ST_X(p.geom::geometry),
         round(ST_Distance(p.geom, me.g))::int,
         (p_brand is not null and (lower(coalesce(p.tags->>'brand','')) like '%' || lower(p_brand) || '%'
                                   or lower(coalesce(p.name,'')) like '%' || lower(p_brand) || '%')),
         p.tags
  from places p, me
  where p.status = 'active'
    and ST_DWithin(p.geom, me.g, least(greatest(p_radius_m, 1000), 100000))
    and (p.category in ('repair','tyres','car_dealer')
         or (p.category = 'ev_charging' and p_fuel in ('electric','hybrid'))
         or (p.category = 'lpg' and p_fuel = 'lpg'))
  order by 7 desc, 6
  limit 100;
$$;

-- Ziyaret edilen iller (Türkiye haritası boyama)
create or replace function public.visited_provinces(p_user uuid default null)
returns table (code smallint, first_visit timestamptz, checkins int)
language sql stable security definer set search_path = public as $$
  select pl.province_code, min(c.created_at), count(*)::int
  from checkins c join places pl on pl.id = c.place_id
  where c.user_id = coalesce(p_user, auth.uid())
    and pl.province_code is not null
    and (coalesce(p_user, auth.uid()) = auth.uid()
         or exists (select 1 from profiles pr where pr.id = p_user and pr.is_public))
  group by pl.province_code;
$$;

create or replace function public.profile_stats(p_user uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when coalesce(p_user, auth.uid()) = auth.uid()
                or exists (select 1 from profiles pr where pr.id = p_user and pr.is_public)
  then jsonb_build_object(
    'checkins', (select count(*) from checkins where user_id = coalesce(p_user, auth.uid())),
    'provinces', (select count(*) from visited_provinces(coalesce(p_user, auth.uid()))),
    'km', user_km(coalesce(p_user, auth.uid())),
    'badges', (select count(*) from user_badges where user_id = coalesce(p_user, auth.uid())),
    'places_added', (select count(*) from places where created_by = coalesce(p_user, auth.uid()) and status = 'active'),
    'reviews', (select count(*) from place_reviews where user_id = coalesce(p_user, auth.uid()) and status = 'active'))
  else null end;
$$;

create or replace function public.province_shapes() returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_build_object('type','FeatureCollection','features', jsonb_agg(jsonb_build_object(
    'type','Feature','id', code,'properties', jsonb_build_object('code', code, 'name', name, 'region', region),
    'geometry', geom_simple) order by code)), '{}'::jsonb)
  from provinces where geom_simple is not null;
$$;

-- ---------------------------------------------------------------------------
-- Engelleme ve şikâyet
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  target_type text not null check (target_type in ('user','place','review','photo','message','broadcast')),
  target_id text not null,
  reason text not null check (reason in ('spam','harassment','inappropriate','wrong_info','dangerous','other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
alter table public.reports enable row level security;
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_read_own on public.reports for select to authenticated using (reporter_id = auth.uid());

-- 3 farklı şikâyet alan içerik otomatik gizlenir (moderatör sonra bakar)
create or replace function public.after_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from reports where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if n >= 3 then
    if new.target_type = 'place' then update places set status = 'hidden' where id::text = new.target_id and source = 'user';
    elsif new.target_type = 'review' then update place_reviews set status = 'hidden' where id::text = new.target_id;
    elsif new.target_type = 'photo' then update place_photos set status = 'hidden' where id::text = new.target_id;
    end if;
  end if;
  return null;
end $$;
create trigger reports_after after insert on public.reports for each row execute function public.after_report();

-- ---------------------------------------------------------------------------
-- Yakınımdaki yolcular
-- ---------------------------------------------------------------------------

-- Konum ~2 km ızgaraya yuvarlanır, 6 saat sonra geçersiz olur. Kimse doğrudan okuyamaz.
create table public.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cell extensions.geography(Point, 4326) not null,
  expires_at timestamptz not null
);
create index presence_cell_idx on public.presence using gist (cell);
alter table public.presence enable row level security;
-- Politika yok: istemci erişemez, sadece fonksiyonlar.

create or replace function public.snap_cell(p_lat double precision, p_lng double precision)
returns extensions.geography
language sql immutable set search_path = public, extensions as $$
  -- 0.02° ≈ 2.2 km (enlem), Türkiye'de boylamda ≈ 1.6 km
  select ST_SetSRID(ST_MakePoint(round(p_lng / 0.02) * 0.02, round(p_lat / 0.02) * 0.02), 4326)::geography;
$$;

create or replace function public.update_presence(p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not coalesce((select visible_nearby from profile_private where id = uid), false) then
    delete from presence where user_id = uid;
    return;
  end if;
  insert into presence (user_id, cell, expires_at) values (uid, snap_cell(p_lat, p_lng), now() + interval '6 hours')
  on conflict (user_id) do update set cell = excluded.cell, expires_at = excluded.expires_at;
end $$;

create or replace function public.clear_presence() returns void
language sql security definer set search_path = public as $$
  delete from presence where user_id = auth.uid();
$$;

-- Görünürlük kapatılınca konumu hemen sil
create or replace function public.after_private_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.visible_nearby then delete from presence where user_id = new.id; end if;
  return null;
end $$;
create trigger profile_private_after after update of visible_nearby on public.profile_private
  for each row execute function public.after_private_change();

create or replace function public.nearby_candidates(uid uuid, p_lat double precision, p_lng double precision, p_radius_km int)
returns table (user_id uuid)
language sql stable security definer set search_path = public, extensions as $$
  select pr.user_id from presence pr
  where pr.user_id <> uid
    and pr.expires_at > now()
    and ST_DWithin(pr.cell, snap_cell(p_lat, p_lng), least(greatest(p_radius_km, 1), 50) * 1000)
    and not is_blocked_between(uid, pr.user_id)
  order by ST_Distance(pr.cell, snap_cell(p_lat, p_lng)), random()
  limit 10;
$$;
revoke all on function public.nearby_candidates(uuid, double precision, double precision, int) from public, anon, authenticated;

-- Sadece sayı döner (en fazla 10). Kimlik/mesafe asla dönmez.
create or replace function public.nearby_count(p_lat double precision, p_lng double precision, p_radius_km int default 25) returns int
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then 0 else (select count(*)::int from nearby_candidates(auth.uid(), p_lat, p_lng, p_radius_km)) end;
$$;

-- ---------------------------------------------------------------------------
-- Mesajlar
-- ---------------------------------------------------------------------------

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  recipient_count int not null default 0,
  created_at timestamptz not null default now()
);
create index broadcasts_sender_idx on public.broadcasts (sender_id, created_at desc);
alter table public.broadcasts enable row level security;

create table public.broadcast_recipients (
  broadcast_id uuid not null references public.broadcasts (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  dismissed boolean not null default false,
  replied boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (broadcast_id, recipient_id)
);
create index broadcast_recipients_recipient_idx on public.broadcast_recipients (recipient_id, created_at desc);
alter table public.broadcast_recipients enable row level security;
create policy br_read_own on public.broadcast_recipients for select to authenticated using (recipient_id = auth.uid());
create policy br_dismiss_own on public.broadcast_recipients for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Gönderen kendi yayınını görür; alıcı kendisine gelen yayını görür.
create policy broadcasts_read on public.broadcasts for select to authenticated using (
  sender_id = auth.uid()
  or exists (select 1 from public.broadcast_recipients r where r.broadcast_id = broadcasts.id and r.recipient_id = auth.uid())
);

create or replace function public.send_broadcast(p_lat double precision, p_lng double precision, p_body text, p_radius_km int default 25)
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  bid uuid;
  n int;
  account_age interval;
  daily_limit int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_clean(p_body) then raise exception 'inappropriate_content'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'empty'; end if;
  select now() - created_at into account_age from auth.users where id = uid;
  daily_limit := case when account_age < interval '1 day' then 1 else 3 end;
  if (select count(*) from broadcasts where sender_id = uid and created_at > now() - interval '1 day') >= daily_limit then
    raise exception 'rate_limited';
  end if;
  insert into broadcasts (sender_id, body) values (uid, trim(p_body)) returning id into bid;
  insert into broadcast_recipients (broadcast_id, recipient_id)
  select bid, c.user_id from nearby_candidates(uid, p_lat, p_lng, p_radius_km) c;
  get diagnostics n = row_count;
  update broadcasts set recipient_count = n where id = bid;
  return n;
end $$;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  broadcast_id uuid references public.broadcasts (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
alter table public.conversations enable row level security;
create policy conversations_read on public.conversations for select to authenticated
  using (auth.uid() in (user_a, user_b));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 1000),
  kind text not null default 'text' check (kind in ('text','system')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conv_idx on public.messages (conversation_id, created_at);
alter table public.messages enable row level security;
create policy messages_read on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id and auth.uid() in (c.user_a, c.user_b))
);
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and kind = 'text' and public.is_clean(body)
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)
      and not public.is_blocked_between(c.user_a, c.user_b)
  )
);
-- Okundu bilgisi: sadece karşı tarafın mesajı için
create policy messages_mark_read on public.messages for update to authenticated using (
  sender_id <> auth.uid()
  and exists (select 1 from public.conversations c where c.id = messages.conversation_id and auth.uid() in (c.user_a, c.user_b))
) with check (sender_id <> auth.uid());

create or replace function public.after_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end $$;
create trigger messages_after after insert on public.messages for each row execute function public.after_message();

-- Sadece içerik değişmesin, okundu bilgisi değişebilsin
create or replace function public.messages_guard() returns trigger
language plpgsql as $$
begin
  if new.body is distinct from old.body or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id or new.kind is distinct from old.kind
     or new.created_at is distinct from old.created_at then
    raise exception 'immutable';
  end if;
  return new;
end $$;
create trigger messages_guard before update on public.messages for each row execute function public.messages_guard();

-- Alıcı yayına cevap verince birebir sohbet açılır.
create or replace function public.reply_to_broadcast(p_broadcast uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  sender uuid;
  a uuid; b uuid;
  cid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_clean(p_body) then raise exception 'inappropriate_content'; end if;
  select br.sender_id into sender from broadcasts br
    join broadcast_recipients r on r.broadcast_id = br.id and r.recipient_id = uid
    where br.id = p_broadcast;
  if sender is null then raise exception 'not_found'; end if;
  if is_blocked_between(uid, sender) then raise exception 'blocked'; end if;
  a := least(uid, sender); b := greatest(uid, sender);
  insert into conversations (user_a, user_b, broadcast_id) values (a, b, p_broadcast)
  on conflict (user_a, user_b) do update set last_message_at = now()
  returning id into cid;
  insert into messages (conversation_id, sender_id, body, kind)
  select cid, sender, br.body, 'text' from broadcasts br
  where br.id = p_broadcast and not exists (select 1 from messages m where m.conversation_id = cid and m.body = br.body and m.sender_id = sender);
  insert into messages (conversation_id, sender_id, body) values (cid, uid, trim(p_body));
  update broadcast_recipients set replied = true where broadcast_id = p_broadcast and recipient_id = uid;
  return cid;
end $$;

-- ---------------------------------------------------------------------------
-- Karşılıklı, tek seferlik konum paylaşımı
-- ---------------------------------------------------------------------------

create table public.location_shares (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.location_shares enable row level security;
-- Politika yok: sadece fonksiyonlar. Paylaşımlar 30 dk içinde eşleşmezse geçersiz, 24 saatte silinir.

create or replace function public.share_location(p_conversation uuid, p_lat double precision, p_lng double precision) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c record;
begin
  select * into c from conversations where id = p_conversation and uid in (user_a, user_b);
  if not found then raise exception 'not_found'; end if;
  if is_blocked_between(c.user_a, c.user_b) then raise exception 'blocked'; end if;
  delete from location_shares where created_at < now() - interval '24 hours';
  insert into location_shares (conversation_id, user_id, lat, lng) values (p_conversation, uid, p_lat, p_lng)
  on conflict (conversation_id, user_id) do update set lat = excluded.lat, lng = excluded.lng, created_at = now();
  insert into messages (conversation_id, sender_id, body, kind) values (p_conversation, uid, 'location_share', 'system');
  return get_location_share(p_conversation);
end $$;

create or replace function public.get_location_share(p_conversation uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c record; mine record; theirs record;
begin
  select * into c from conversations where id = p_conversation and uid in (user_a, user_b);
  if not found then raise exception 'not_found'; end if;
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
-- Yola çıkış kontrol listesi
-- ---------------------------------------------------------------------------

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  label text not null check (char_length(label) between 1 and 120),
  sort int not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index checklist_user_idx on public.checklist_items (user_id, sort);
alter table public.checklist_items enable row level security;
create policy checklist_own on public.checklist_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Bağışlar (mağaza makbuzu sunucuda doğrulanınca yazılır)
-- ---------------------------------------------------------------------------

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  platform text not null check (platform in ('ios','android')),
  product_id text not null,
  transaction_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.donations enable row level security;
create policy donations_read_own on public.donations for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Hesap: kayıt sonrası profil, veri dışa aktarma, silme
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; candidate text; i int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', ''), '[^a-zA-Z0-9_.]', '', 'g'));
  if base = '' then base := 'yolcu' || (floor(random() * 900000) + 100000)::int; end if;
  if char_length(base) < 3 then base := 'yolcu' || base; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    i := i + 1;
    candidate := base || (floor(random() * 9000) + 1000)::int;
    exit when i > 20;
  end loop;
  insert into profiles (id, username, display_name) values (new.id, candidate, nullif(left(new.raw_user_meta_data->>'display_name', 40), ''));
  insert into profile_private (id, locale) values (new.id, case when new.raw_user_meta_data->>'locale' = 'en' then 'en' else 'tr' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', id, 'email', email, 'created_at', created_at) from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from profiles p where id = auth.uid()),
    'settings', (select to_jsonb(p) from profile_private p where id = auth.uid()),
    'vehicles', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from vehicles v where user_id = auth.uid()),
    'checkins', (select coalesce(jsonb_agg(jsonb_build_object('place_id', place_id, 'at', created_at)), '[]') from checkins where user_id = auth.uid()),
    'badges', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from user_badges b where user_id = auth.uid()),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from place_reviews r where user_id = auth.uid()),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('place_id', place_id, 'path', path, 'at', created_at)), '[]') from place_photos where user_id = auth.uid()),
    'places_added', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'category', category)), '[]') from places where created_by = auth.uid()),
    'checklist', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from checklist_items c where user_id = auth.uid()),
    'broadcasts_sent', (select coalesce(jsonb_agg(jsonb_build_object('body', body, 'at', created_at)), '[]') from broadcasts where sender_id = auth.uid()),
    'messages_sent', (select coalesce(jsonb_agg(jsonb_build_object('body', body, 'at', created_at)), '[]') from messages where sender_id = auth.uid()),
    'blocks', (select coalesce(jsonb_agg(blocked_id), '[]') from blocks where blocker_id = auth.uid())
  );
$$;

-- Hesabı ve tüm kişisel verileri siler (fotoğraf dosyaları istemci tarafından önce silinir).
-- Eklenen yerler topluluk verisi olarak anonim kalır (created_by = null).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = uid;
end $$;

-- ---------------------------------------------------------------------------
-- Sunucu tarafı içe aktarma ve kota (sadece service_role)
-- ---------------------------------------------------------------------------

create table public.api_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  kind text not null,
  count int not null default 0,
  primary key (user_id, day, kind)
);
alter table public.api_usage enable row level security;

create or replace function public.consume_api_quota(p_user uuid, p_kind text, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into api_usage (user_id, kind, count) values (p_user, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = api_usage.count + 1
  returning count into n;
  delete from api_usage where day < current_date - 7;
  return n <= p_limit;
end $$;

-- İl sınırı (GeoJSON) yükle; sadeleştirilmiş hali harita boyama için saklanır.
create or replace function public.import_province(p_code smallint, p_geojson jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare g geometry;
begin
  g := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326)), 3));
  update provinces set geom = g::geography,
    geom_simple = ST_AsGeoJSON(ST_Multi(ST_SimplifyPreserveTopology(g, 0.01)), 3)::jsonb
  where code = p_code;
end $$;

-- OSM yerlerini toplu ekle/güncelle. p_rows: [{t,i,c,n,lat,lng,tags}]
create or replace function public.import_osm_places(p_rows jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  insert into places (source, osm_type, osm_id, category, name, tags, geom)
  select 'osm', r->>'t', (r->>'i')::bigint, r->>'c', nullif(left(r->>'n', 120), ''), coalesce(r->'tags', '{}'::jsonb),
         ST_SetSRID(ST_MakePoint((r->>'lng')::float8, (r->>'lat')::float8), 4326)::geography
  from jsonb_array_elements(p_rows) r
  on conflict (osm_type, osm_id) do update set
    category = excluded.category, name = excluded.name, tags = excluded.tags, geom = excluded.geom
  where places.source = 'osm';
  get diagnostics n = row_count;
  return n;
end $$;

-- İl sınırları sonradan yüklenirse eksik illeri doldur
create or replace function public.backfill_place_provinces() returns int
language sql security definer set search_path = public, extensions as $$
  with u as (
    update places pl set province_code = p.code
    from provinces p
    where pl.province_code is null and p.geom is not null and ST_Intersects(p.geom, pl.geom)
    returning 1
  ) select count(*)::int from u;
$$;

-- ---------------------------------------------------------------------------
-- Dosya depolama (fotoğraflar). Her kullanıcı sadece kendi klasörüne yazar.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('place-photos', 'place-photos', true, 5242880, array['image/jpeg','image/png','image/webp']),
      ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do nothing;
    execute $p$create policy media_insert_own on storage.objects for insert to authenticated
      with check (bucket_id in ('place-photos','avatars') and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy media_update_own on storage.objects for update to authenticated
      using (bucket_id in ('place-photos','avatars') and owner_id = auth.uid()::text)$p$;
    execute $p$create policy media_delete_own on storage.objects for delete to authenticated
      using (bucket_id in ('place-photos','avatars') and owner_id = auth.uid()::text)$p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------

-- PostgreSQL fonksiyonları varsayılan olarak herkese (PUBLIC) açar; önce kapat, sonra seçerek aç.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.places_in_bbox(double precision, double precision, double precision, double precision, text[], text[], int) to anon;
grant execute on function public.province_shapes() to anon;
-- Sadece içeride kullanılan fonksiyonlar
revoke execute on function public.evaluate_badges(uuid) from authenticated;
revoke execute on function public.nearby_candidates(uuid, double precision, double precision, int) from authenticated;
revoke execute on function public.refresh_place_stats(bigint) from authenticated;
revoke execute on function public.user_km(uuid) from authenticated;
revoke execute on function public.consume_api_quota(uuid, text, int) from authenticated;
revoke execute on function public.import_province(smallint, jsonb) from authenticated;
revoke execute on function public.import_osm_places(jsonb) from authenticated;
revoke execute on function public.backfill_place_provinces() from authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Mesajlar gerçek zamanlı gelsin
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.broadcast_recipients, public.conversations;
  end if;
end $$;

-- Süresi dolan konum kayıtlarını temizle (pg_cron varsa)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('yolustu-cleanup', '*/30 * * * *',
    $c$delete from public.presence where expires_at < now(); delete from public.location_shares where created_at < now() - interval '24 hours';$c$);
exception when others then
  raise notice 'pg_cron kullanılamadı: %', sqlerrm;
end $$;
