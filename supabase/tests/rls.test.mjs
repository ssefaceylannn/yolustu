// Şema ve güvenlik kuralları testi: PGlite + PostGIS üzerinde Supabase'in auth/rol yapısı taklit edilir.
// Çalıştırma: node supabase/tests/rls.test.mjs  (gerekli paketler: @electric-sql/pglite, @electric-sql/pglite-postgis)
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const db = new PGlite({ extensions: { postgis } });
let failures = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; } else { failures++; console.error("✗ " + msg); } };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema extensions;
  grant usage on schema public, extensions, auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
await db.exec("set search_path to public, extensions");
for (const f of readdirSync(join(here, "../migrations")).sort()) {
  await db.exec(readFileSync(join(here, "../migrations", f), "utf8"));
}

const as = async (uid, fn) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ""}', false);`);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try { return await fn(); } finally { await db.exec("reset role"); }
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
const throws = async (fn) => { try { await fn(); return false; } catch (e) { return e.message || true; } };

// Kullanıcılar
const [A, B, C] = (await q(`insert into auth.users (email, raw_user_meta_data) values
  ('a@x.com', '{"username":"Ali_Yolda"}'), ('b@x.com', '{}'), ('c@x.com', '{"username":"cem"}') returning id`)).map(r => r.id);
await q(`update auth.users set created_at = now() - interval '3 days'`);
const profs = await q(`select id, username from profiles order by username`);
ok(profs.length === 3, "kayıtta profil oluşmalı");
ok(profs.some(p => p.username === "ali_yolda"), "kullanıcı adı küçük harfe çevrilmeli");
ok(!profs.some(p => p.username.includes("b@") || p.username === "b"), "kullanıcı adı e-postadan türetilmemeli");

// Test ili ve yerler (İstanbul civarı)
await q(`update provinces set geom = ST_Multi(ST_GeomFromText('POLYGON((28 40.8, 29.9 40.8, 29.9 41.6, 28 41.6, 28 40.8))', 4326))::geography,
  geom_simple = '{"type":"Polygon","coordinates":[[[28,40.8],[29.9,40.8],[29.9,41.6],[28,41.6],[28,40.8]]]}' where code = 34`);
const places = await q(`insert into places (source, osm_type, osm_id, category, name, tags, geom) values
  ('osm','node',1,'campsite','Kamp A','{"electricity":"yes","fee":"no"}', ST_SetSRID(ST_MakePoint(29.0, 41.0),4326)::geography),
  ('osm','node',2,'beach','Plaj B','{}', ST_SetSRID(ST_MakePoint(29.5, 41.2),4326)::geography),
  ('osm','node',3,'repair','Ford Servis','{"brand":"Ford"}', ST_SetSRID(ST_MakePoint(29.01, 41.01),4326)::geography),
  ('osm','node',4,'campsite','Uzak Kamp','{}', ST_SetSRID(ST_MakePoint(33.0, 39.0),4326)::geography)
  returning id, province_code`);
ok(places[0].province_code === 34, "il otomatik atanmalı");
const [P1, P2, P3] = places.map(p => p.id);

// Harita sorguları
let rows = await as(null, () => q(`select * from places_in_bbox(28, 40, 30, 42)`));
ok(rows.length === 3, "anon harita sorgusu 3 yer döndürmeli, dönen: " + rows.length);
rows = await as(null, () => q(`select * from places_in_bbox(28, 40, 30, 42, array['campsite'], array['electricity','free'])`));
ok(rows.length === 1 && rows[0].name === "Kamp A", "filtreler çalışmalı");
rows = await as(A, () => q(`select * from places_along_route($1::jsonb, 5000)`, [JSON.stringify({ type: "LineString", coordinates: [[28.9, 41.0], [29.6, 41.2]] })]));
ok(rows.length >= 2 && rows.every(r => r.distance_from_route_m <= 5000), "rota üstündeki yerler bulunmalı");
ok(rows[0].route_fraction <= rows[rows.length - 1].route_fraction, "rota sırasına göre dizilmeli");
rows = await as(A, () => q(`select * from services_near(41.0, 29.0, 'Ford', 'diesel')`));
ok(rows.length === 1 && rows[0].brand_match === true, "marka servisi bulunmalı");
ok(await as(null, () => throws(() => q(`select * from places_along_route('{"type":"LineString","coordinates":[[28,41],[29,41]]}'::jsonb)`))), "anon rota sorgusu yapamamalı");

// Check-in
let r = (await as(A, () => q(`select check_in($1, 41.02, 29.0) r`, [P1])))[0].r;
ok(r.ok === false && r.reason === "too_far", "150 m dışı check-in reddedilmeli");
r = (await as(A, () => q(`select check_in($1, 41.0005, 29.0005) r`, [P1])))[0].r;
ok(r.ok === true && r.first === true && r.new_badges.includes("first_step") && r.new_badges.includes("pioneer_1"), "check-in ve rozetler: " + JSON.stringify(r));
r = (await as(A, () => q(`select check_in($1, 41.0005, 29.0005) r`, [P1])))[0].r;
ok(r.ok === false && r.reason === "already_checked_in", "aynı yere 12 saatte bir check-in");
r = (await as(A, () => q(`select check_in($1, 41.2, 29.5) r`, [P2])))[0].r;
ok(r.ok, "ikinci check-in");
ok(await as(A, () => throws(() => q(`insert into checkins (user_id, place_id) values ($1, $2)`, [A, P1]))), "doğrudan check-in eklenememeli");
const stats = (await as(A, () => q(`select profile_stats() s`)))[0].s;
ok(stats.checkins === 2 && stats.provinces === 1 && stats.km > 40, "istatistikler: " + JSON.stringify(stats));
rows = await as(A, () => q(`select * from visited_provinces()`));
ok(rows.length === 1 && rows[0].code === 34, "ziyaret edilen il");
rows = await as(B, () => q(`select * from checkins`));
ok(rows.length === 2, "açık profilin check-in'leri görünür");
await as(A, () => q(`update profiles set is_public = false where id = $1`, [A]));
rows = await as(B, () => q(`select * from checkins`));
ok(rows.length === 0, "gizli profilin check-in'leri görünmemeli");
ok((await as(B, () => q(`select profile_stats($1) s`, [A])))[0].s === null, "gizli profilin istatistikleri görünmemeli");
ok((await as(B, () => q(`select * from visited_provinces($1)`, [A]))).length === 0, "gizli profilin illeri görünmemeli");
ok(!(await q(`select column_name from information_schema.columns where table_name='checkins'`)).some(c => /lat|lng|geom/.test(c.column_name)), "check-in koordinat saklamamalı");

// Yorum ve küfür filtresi
ok(await as(B, () => throws(() => q(`insert into place_reviews (place_id, rating, body) values ($1, 5, 'tam bir piç yer')`, [P1]))), "küfürlü yorum reddedilmeli");
await as(B, () => q(`insert into place_reviews (place_id, rating, body) values ($1, 4, 'Temiz ve sakin')`, [P1]));
ok((await q(`select rating_avg, rating_count from places where id = $1`, [P1]))[0].rating_count === 1, "puan istatistiği güncellenmeli");
ok(await as(A, () => throws(async () => { const x = await q(`update place_reviews set body = 'x' where user_id = $1 returning id`, [B]); if (!x.length) throw new Error("0 rows"); })), "başkasının yorumu değiştirilememeli");

// Araç gizliliği
await as(A, () => q(`insert into vehicles (kind, brand, model, fuel, gearbox, height_cm) values ('motorhome','Fiat','Ducato','diesel','manual',290)`));
ok((await as(B, () => q(`select * from vehicles`))).length === 0, "başkasının aracı görünmemeli");
ok((await as(A, () => q(`select * from vehicles`))).length === 1, "kendi aracı görünmeli");

// Yer ekleme
ok(await as(A, () => throws(() => q(`select add_place('wild_camp', 'Gizli koy', null, 48.0, 2.0)`))), "Türkiye dışı yer eklenememeli");
const newPlace = (await as(A, () => q(`select add_place('wild_camp', 'Gizli koy', 'Sessiz', 41.1, 29.1, '{"water":"yes","hack":"1"}') id`)))[0].id;
const np = (await q(`select tags, created_by, province_code from places where id = $1`, [newPlace]))[0];
ok(np.created_by === A && np.province_code === 34 && np.tags.water === "yes" && !np.tags.hack, "yer ekleme ve etiket temizliği");
ok(await as(A, () => throws(() => q(`insert into places (category, geom) values ('campsite', 'SRID=4326;POINT(29 41)')`))), "doğrudan yer eklenememeli");

// Yakınımdaki yolcular
ok((await as(A, () => q(`select nearby_count(41.0, 29.0) n`)))[0].n === 0, "kimse görünür değilken 0");
for (const u of [A, B]) {
  await as(u, () => q(`update profile_private set visible_nearby = true where id = $1`, [u]));
  await as(u, () => q(`select update_presence(41.0123, 29.0456)`));
}
await as(C, () => q(`select update_presence(41.01, 29.04)`)); // C görünür değil, kaydedilmemeli
ok((await q(`select count(*)::int n from presence`))[0].n === 2, "görünür olmayanın konumu kaydedilmemeli");
const cell = (await q(`select ST_Y(cell::geometry) lat, ST_X(cell::geometry) lng from presence where user_id = $1`, [A]))[0];
ok(Math.abs(cell.lat - 41.02) < 1e-9 && Math.abs(cell.lng - 29.04) < 1e-9, "konum ızgaraya yuvarlanmalı: " + JSON.stringify(cell));
ok((await as(B, () => q(`select * from presence`))).length === 0, "presence tablosu okunamamalı");
ok((await as(B, () => q(`select nearby_count(41.0, 29.0) n`)))[0].n === 1, "B yakınında 1 kişi görmeli");
ok((await as(C, () => q(`select nearby_count(41.0, 29.0) n`)))[0].n === 2, "C yakınında 2 kişi görmeli");
ok(await as(B, () => throws(() => q(`select * from nearby_candidates($1, 41, 29, 25)`, [B]))), "aday listesi doğrudan çağrılamamalı");

// Toplu mesaj
ok(await as(C, () => throws(() => q(`select send_broadcast(41.0, 29.0, 'siktir git')`))), "küfürlü yayın reddedilmeli");
const sent = (await as(C, () => q(`select send_broadcast(41.0, 29.0, 'Merhaba, yakında su alınacak yer bilen var mı?') n`)))[0].n;
ok(sent === 2, "yayın 2 kişiye gitmeli");
const bc = (await as(A, () => q(`select * from broadcasts`)))[0];
ok(bc && bc.sender_id === C, "alıcı yayını görmeli");
ok((await as(C, () => q(`select * from broadcast_recipients`))).length === 0, "gönderen alıcıları görmemeli");
ok(await as(C, () => throws(async () => { await q(`select send_broadcast(41.0, 29.0, 'tekrar')`); await q(`select send_broadcast(41.0, 29.0, 'tekrar 2')`); await q(`select send_broadcast(41.0, 29.0, 'tekrar 3')`); })), "günlük yayın sınırı");
const conv = (await as(A, () => q(`select reply_to_broadcast($1, 'Köy çeşmesi var, 2 km ileride') id`, [bc.id])))[0].id;
rows = await as(C, () => q(`select body, sender_id from messages where conversation_id = $1 order by created_at`, [conv]));
ok(rows.length === 2, "sohbet iki mesajla açılmalı");
ok((await as(B, () => q(`select * from messages`))).length === 0, "üçüncü kişi mesajları görmemeli");
ok((await as(B, () => q(`select * from conversations`))).length === 0, "üçüncü kişi sohbeti görmemeli");
await as(C, () => q(`insert into messages (conversation_id, body) values ($1, 'Teşekkürler!')`, [conv]));
ok(await as(B, () => throws(() => q(`insert into messages (conversation_id, body) values ($1, 'araya giriyorum')`, [conv]))), "dışarıdan mesaj eklenememeli");
await as(C, () => q(`update messages set body = 'değişti' where sender_id = $1`, [C]));
ok((await q(`select count(*)::int n from messages where body = 'değişti'`))[0].n === 0, "gönderen mesajını değiştirememeli");
ok(await as(A, () => throws(() => q(`update messages set body = 'değişti' where sender_id = $1`, [C]))), "karşı taraf mesaj içeriğini değiştirememeli");
await as(A, () => q(`update messages set read_at = now() where sender_id = $1`, [C]));
ok((await q(`select count(*) filter (where read_at is null)::int n, count(*)::int t from messages where sender_id = $1`, [C]))[0].n === 0, "okundu bilgisi işlenmeli");

// Konum paylaşımı
let ls = (await as(A, () => q(`select share_location($1, 41.0011, 29.0022) s`, [conv])))[0].s;
ok(ls.status === "waiting_them" && !ls.theirs, "tek taraflı paylaşımda beklemede");
ls = (await as(C, () => q(`select get_location_share($1) s`, [conv])))[0].s;
ok(ls.status === "waiting_me" && !ls.theirs && !JSON.stringify(ls).includes("41.0011"), "karşı taraf konumu paylaşmadan göremez");
ok((await as(C, () => q(`select * from location_shares`))).length === 0, "paylaşım tablosu okunamamalı");
ls = (await as(C, () => q(`select share_location($1, 41.2, 29.5) s`, [conv])))[0].s;
ok(ls.status === "complete" && ls.theirs.lat === 41.0011, "iki taraf paylaşınca tamamlanmalı");
ok(await as(B, () => throws(() => q(`select get_location_share($1)`, [conv]))), "üçüncü kişi paylaşımı göremez");

// Engelleme
await as(A, () => q(`insert into blocks (blocked_id) values ($1)`, [C]));
ok(await as(C, () => throws(() => q(`insert into messages (conversation_id, body) values ($1, 'selam?')`, [conv]))), "engellenen mesaj atamamalı");
ok((await as(C, () => q(`select nearby_count(41.0, 29.0) n`)))[0].n === 1, "engelleyen yakındakiler listesinde sayılmamalı");
ok((await as(C, () => q(`select * from blocks`))).length === 0, "engel listesi sadece sahibine görünür");

// Şikâyet → otomatik gizleme
for (const u of [B, C]) await as(u, () => q(`insert into reports (target_type, target_id, reason) values ('place', $1, 'wrong_info')`, [String(newPlace)]));
const D = (await q(`insert into auth.users (email) values ('d@x.com') returning id`))[0].id;
await as(D, () => q(`insert into reports (target_type, target_id, reason) values ('place', $1, 'wrong_info')`, [String(newPlace)]));
ok((await as(B, () => q(`select * from places where id = $1`, [newPlace]))).length === 0, "3 şikâyet alan kullanıcı yeri gizlenmeli");

// Kontrol listesi
await as(A, () => q(`insert into checklist_items (label) values ('Gaz vanası')`));
ok((await as(B, () => q(`select * from checklist_items`))).length === 0, "kontrol listesi özel");

// Dışa aktarma ve silme
const ex = (await as(A, () => q(`select export_my_data() d`)))[0].d;
ok(ex.account.email === "a@x.com" && ex.checkins.length === 2 && ex.vehicles.length === 1, "veri dışa aktarma");
ok(!JSON.stringify(ex).includes("b@x.com"), "dışa aktarmada başkasının verisi olmamalı");
await as(A, () => q(`select delete_my_account()`));
ok((await q(`select count(*)::int n from auth.users where id = $1`, [A]))[0].n === 0, "hesap silinmeli");
for (const t of ["profiles", "profile_private", "vehicles", "checkins", "user_badges", "presence", "checklist_items"]) {
  const col = ["profiles", "profile_private"].includes(t) ? "id" : "user_id";
  ok((await q(`select count(*)::int n from ${t} where ${col} = $1`, [A]))[0].n === 0, `${t} temizlenmeli`);
}
ok((await q(`select created_by from places where id = $1`, [newPlace]))[0].created_by === null, "eklenen yer anonimleşmeli");

// Sadece sunucunun kullanabileceği fonksiyonlar
for (const fn of ["import_osm_places('[]'::jsonb)", "consume_api_quota(gen_random_uuid(), 'x', 1)", "backfill_place_provinces()", "evaluate_badges(gen_random_uuid())"]) {
  ok(await as(B, () => throws(() => q(`select ${fn}`))), `kullanıcı ${fn} çağıramamalı`);
}
await q(`select import_osm_places($1::jsonb)`, [JSON.stringify([{ t: "node", i: 99, c: "water", n: "Çeşme", lat: 41.05, lng: 29.05, tags: { fee: "no" } }])]);
ok((await q(`select province_code from places where osm_id = 99`))[0].province_code === 34, "OSM içe aktarma");
await q(`select import_province(6::smallint, '{"type":"Polygon","coordinates":[[[32,39.5],[33.5,39.5],[33.5,40.5],[32,40.5],[32,39.5]]]}'::jsonb)`);
ok((await q(`select geom_simple is not null ok from provinces where code = 6`))[0].ok, "il sınırı içe aktarma");
ok((await q(`select backfill_place_provinces() n`))[0].n >= 0, "il doldurma");
ok((await as(null, () => q(`select province_shapes() s`)))[0].s.features.length === 2, "il şekilleri anonim okunabilir");
ok((await q(`select consume_api_quota($1, 'route', 2) a, consume_api_quota($1, 'route', 2) b, consume_api_quota($1, 'route', 2) c`, [B]))[0].c === false, "kota sınırı");

// anon yetkileri
ok(await as(null, () => throws(() => q(`select * from profiles`))) || (await as(null, () => q(`select * from profiles`))).length === 0, "anon profilleri görmemeli");
ok(await as(null, () => throws(() => q(`select send_broadcast(41,29,'x')`))), "anon yayın gönderememeli");

console.log(`\n${passes} geçti, ${failures} başarısız`);
process.exit(failures ? 1 : 0);
