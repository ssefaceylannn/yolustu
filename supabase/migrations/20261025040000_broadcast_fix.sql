-- Toplu mesaj: geçici tablo kullanılmaz; konum kaydı yoksa/eskiyse gönderirken yenilenir.
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
  if not coalesce((select visible_nearby from profile_private where id = uid), false) then raise exception 'not_visible'; end if;
  if p_lat is not null and p_lng is not null then perform update_presence(p_lat, p_lng); end if;
  if not exists (select 1 from presence where user_id = uid and expires_at > now()) then raise exception 'not_visible'; end if;
  select now() - created_at into account_age from auth.users where id = uid;
  daily_limit := case when account_age < interval '1 day' then 1 else 3 end;
  if (select count(*) from broadcasts where sender_id = uid and created_at > now() - interval '1 day') >= daily_limit then
    raise exception 'rate_limited';
  end if;
  insert into broadcasts (sender_id, body) values (uid, trim(p_body)) returning id into bid;
  with c as materialized (select * from nearby_candidates(uid, p_radius_km)),
       ins as (insert into broadcast_recipients (broadcast_id, recipient_id) select bid, c.user_id from c where not c.blocked returning 1)
  select count(*) into total from c;
  update broadcasts set recipient_count = total where id = bid;
  return total;
end $$;
