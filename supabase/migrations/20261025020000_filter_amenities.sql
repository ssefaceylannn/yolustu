-- Olanak filtresi: yerin kendisi o olanaksa (ör. su çeşmesi = su) filtreyi karşılar.
-- Önceden "Su" seçilince çeşmeler, "Tuvalet" seçilince tuvaletler de gizleniyordu.
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
      where not (case
        when f = 'free' then coalesce(p.tags ->> 'fee', '') = 'no'
        when f = 'water' and p.category in ('water', 'spring') then true
        when f = 'toilet' and p.category = 'toilet' then true
        when f = 'shower' and p.category = 'shower' then true
        when f = 'electricity' and p.category = 'ev_charging' then true
        else coalesce(p.tags ->> f, 'no') in ('yes', 'true') end)
    ))
  order by p.rating_count desc, p.checkin_count desc, p.id
  limit least(greatest(p_limit, 1), 800);
$$;
