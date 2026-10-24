-- Hızlı il bulma: il sınırları küçük parçalara bölünüp indekslenir.
-- (Tam çözünürlüklü sınırlarla nokta başına arama toplu aktarımda zaman aşımına düşüyordu.)

create table public.province_parts (
  code smallint not null references public.provinces (code) on delete cascade,
  geom extensions.geometry(Geometry, 4326) not null
);
create index province_parts_geom_idx on public.province_parts using gist (geom);
create index province_parts_code_idx on public.province_parts (code);
alter table public.province_parts enable row level security;
-- Politika yok: sadece fonksiyonlar kullanır.

create or replace function public.rebuild_province_parts(p_code smallint) returns void
language sql security definer set search_path = public, extensions as $$
  delete from province_parts where code = p_code;
  insert into province_parts (code, geom)
  select p.code, ST_Subdivide(p.geom::geometry, 128)
  from provinces p where p.code = p_code and p.geom is not null;
$$;

-- Mevcut sınırlar için parçaları oluştur
select public.rebuild_province_parts(code) from public.provinces where geom is not null;

-- Sınır değişince parçaları yenile
create or replace function public.after_province_geom() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform rebuild_province_parts(new.code);
  return null;
end $$;
create trigger provinces_after_geom after insert or update of geom on public.provinces
  for each row execute function public.after_province_geom();

-- Yer eklenince il: parçalardan bul
create or replace function public.places_set_province() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.province_code is null or tg_op = 'UPDATE' and new.geom is distinct from old.geom then
    select pp.code into new.province_code
    from public.province_parts pp
    where ST_Intersects(pp.geom, new.geom::geometry)
    limit 1;
  end if;
  return new;
end $$;

create or replace function public.backfill_place_provinces() returns int
language sql security definer set search_path = public, extensions as $$
  with u as (
    update places pl set province_code = pp.code
    from province_parts pp
    where pl.province_code is null and ST_Intersects(pp.geom, pl.geom::geometry)
    returning 1
  ) select count(*)::int from u;
$$;

revoke execute on function public.rebuild_province_parts(smallint) from public, anon, authenticated;
revoke execute on function public.after_province_geom() from public, anon, authenticated;
revoke execute on function public.backfill_place_provinces() from public, anon, authenticated;
