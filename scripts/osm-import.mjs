// OpenStreetMap → Yolüstü veritabanı aktarımı (GitHub Actions'ta çalışır).
// Gerekli ortam değişkenleri: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Kullanım: node scripts/osm-import.mjs [provinces|places|all]
import osmtogeojson from "osmtogeojson";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");
  process.exit(1);
}
const mode = process.argv[2] || "all";
// Eski tip anahtar (JWT) Authorization başlığına da konur; yeni tip (sb_secret_...) sadece apikey başlığıyla gönderilir.
const authHeaders = { apikey: SERVICE_KEY, ...(SERVICE_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}) };
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const AREA = `area["ISO3166-1"="TR"][admin_level=2]->.tr;`;

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Yolustu-Importer/1.0 (github.com/ssefaceylannn/yolustu)" },
        body: "data=" + encodeURIComponent(query),
      });
      if (res.ok) return await res.json();
      lastErr = new Error(`${url} ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    const wait = 20000 * (attempt + 1);
    console.warn(`Overpass hatası (${lastErr.message}), ${wait / 1000} sn sonra tekrar`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw lastErr;
}

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// --- İl sınırları ---------------------------------------------------------

const norm = (s) => (s || "").toLocaleLowerCase("tr").replace(/ ili$/, "").replace(/[^a-zçğıöşü]/g, "");

async function importProvinces() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/provinces?select=code,name`, {
    headers: authHeaders,
  });
  const provinces = await res.json();
  const byName = new Map(provinces.map((p) => [norm(p.name), p.code]));

  console.log("İl sınırları indiriliyor…");
  const data = await overpass(`[out:json][timeout:900];${AREA}rel(area.tr)["boundary"="administrative"]["admin_level"="4"];out geom;`);
  const geo = osmtogeojson(data);
  let done = 0;
  for (const f of geo.features) {
    if (!f.id?.startsWith("relation/") || !/Polygon/.test(f.geometry?.type || "")) continue;
    const t = f.properties || {};
    const iso = t["ISO3166-2"] || "";
    let code = /^TR-(\d{2})$/.test(iso) ? Number(iso.slice(3)) : null;
    if (!code) code = byName.get(norm(t["name:tr"] || t.name)) ?? null;
    if (!code) { console.warn("Eşleşmeyen il:", t.name, iso); continue; }
    await rpc("import_province", { p_code: code, p_geojson: f.geometry });
    done++;
  }
  console.log(`${done} il sınırı yüklendi`);
  if (done < 81) console.warn("Uyarı: 81 ilin hepsi yüklenemedi");
}

// --- Yerler ----------------------------------------------------------------

const yes = (v) => v === "yes" || v === "hot" || v === "customers";

function categorize(t) {
  if (t.tourism === "camp_site") return "campsite";
  if (t.tourism === "caravan_site") return "caravan_site";
  if (t.tourism === "picnic_site") return "picnic";
  if (t.tourism === "viewpoint") return "viewpoint";
  if (t.amenity === "sanitary_dump_station" || t["sanitary_dump_station"] === "yes") return "dump_station";
  if (t.amenity === "drinking_water" || t.amenity === "water_point") return "water";
  if (t.amenity === "toilets") return "toilet";
  if (t.amenity === "shower") return "shower";
  if (t.amenity === "fuel") return t["fuel:lpg"] === "yes" ? "lpg" : "fuel";
  if (t.amenity === "charging_station") return "ev_charging";
  if (t.shop === "car_repair") return "repair";
  if (t.shop === "tyres") return "tyres";
  if (t.shop === "car") return "car_dealer";
  if (t.natural === "beach") return "beach";
  if (t.natural === "water" && t.water === "lake") return "lake";
  if (t.waterway === "waterfall" || t.natural === "waterfall") return "waterfall";
  if (t.natural === "peak") return "peak";
  if (t.natural === "spring") return "spring";
  if (t.natural === "cave_entrance") return "cave";
  if (t.historic) return "historic";
  if (t.tourism === "attraction") return "attraction";
  return null;
}

function cleanTags(t) {
  const out = {};
  if (t.power_supply) out.electricity = yes(t.power_supply) ? "yes" : "no";
  if (t.drinking_water) out.water = yes(t.drinking_water) ? "yes" : "no";
  if (t.shower) out.shower = yes(t.shower) ? "yes" : "no";
  if (t.toilets) out.toilet = yes(t.toilets) ? "yes" : "no";
  if (t.fee) out.fee = t.fee === "no" ? "no" : "yes";
  if (t.internet_access) out.wifi = ["wlan", "yes"].includes(t.internet_access) ? "yes" : "no";
  if (t.dog) out.dogs = t.dog === "no" ? "no" : "yes";
  for (const k of ["brand", "operator", "opening_hours", "website", "ele", "capacity", "fuel:lpg", "fuel:diesel", "name:en", "description"]) {
    if (t[k]) out[k] = String(t[k]).slice(0, 200);
  }
  const phone = t.phone || t["contact:phone"];
  if (phone) out.phone = String(phone).slice(0, 40);
  return out;
}

const GROUPS = [
  `nwr["tourism"~"^(camp_site|caravan_site|picnic_site|viewpoint)$"](area.tr);
   nwr["amenity"~"^(drinking_water|water_point|shower|sanitary_dump_station)$"](area.tr);`,
  `nwr["amenity"~"^(fuel|charging_station)$"](area.tr);
   nwr["shop"~"^(car_repair|tyres|car)$"](area.tr);`,
  `nwr["amenity"="toilets"](area.tr);`,
  `nwr["natural"="beach"](area.tr);
   nwr["natural"~"^(peak|spring|cave_entrance)$"]["name"](area.tr);
   nwr["waterway"="waterfall"](area.tr); nwr["natural"="waterfall"](area.tr);
   nwr["natural"="water"]["water"="lake"]["name"](area.tr);`,
  `nwr["tourism"="attraction"]["name"](area.tr);
   nwr["historic"~"^(castle|ruins|archaeological_site|monument|fort|aqueduct|bridge)$"]["name"](area.tr);`,
];

async function importPlaces() {
  let total = 0;
  for (const [i, g] of GROUPS.entries()) {
    console.log(`Yer grubu ${i + 1}/${GROUPS.length} indiriliyor…`);
    const data = await overpass(`[out:json][timeout:900];${AREA}(${g});out center tags;`);
    const rows = [];
    for (const el of data.elements || []) {
      const t = el.tags || {};
      const c = categorize(t);
      if (!c) continue;
      const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) continue;
      rows.push({ t: el.type, i: el.id, c, n: t["name:tr"] || t.name || "", lat, lng, tags: cleanTags(t) });
    }
    for (let k = 0; k < rows.length; k += 500) {
      total += (await rpc("import_osm_places", { p_rows: rows.slice(k, k + 500) })) ?? 0;
    }
    console.log(`  ${rows.length} yer işlendi`);
    await new Promise((r) => setTimeout(r, 15000)); // Overpass'e nazik ol
  }
  const filled = await rpc("backfill_place_provinces", {});
  console.log(`Toplam ${total} yer eklendi/güncellendi, ${filled} yerin ili dolduruldu`);
}

if (mode === "provinces" || mode === "all") await importProvinces();
if (mode === "places" || mode === "all") await importPlaces();
console.log("Bitti. Veri © OpenStreetMap katkıcıları (ODbL)");
