// Rota ve adres arama (Geoapify). Anahtar sunucuda kalır; kişi başı günlük kota uygulanır.
import { createClient } from "jsr:@supabase/supabase-js@2";

const API_KEY = Deno.env.get("GEOAPIFY_API_KEY") ?? "";
const BASE = "https://api.geoapify.com/v1";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type LngLat = [number, number];
const inTurkeyish = (p: { lat: number; lng: number }) =>
  Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && p.lat > 34 && p.lat < 44 && p.lng > 24 && p.lng < 46;

// Ramer–Douglas–Peucker: rota çizgisini sorgu için sadeleştirir
function simplify(points: LngLat[], tolerance: number): LngLat[] {
  if (points.length <= 2) return points;
  const sqTol = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxSq = 0, index = -1;
    const [ax, ay] = points[first], [bx, by] = points[last];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const sq = ex * ex + ey * ey;
      if (sq > maxSq) { maxSq = sq; index = i; }
    }
    if (maxSq > sqTol && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!API_KEY) return json({ error: "not_configured" }, 503);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const action = body?.action;

  if (action === "geocode") {
    const text = String(body.text ?? "").trim().slice(0, 120);
    if (text.length < 2) return json({ results: [] });
    const { data: allowed } = await admin.rpc("consume_api_quota", { p_user: user.id, p_kind: "geocode", p_limit: 400 });
    if (!allowed) return json({ error: "quota_exceeded" }, 429);
    const url = new URL(`${BASE}/geocode/autocomplete`);
    url.searchParams.set("text", text);
    url.searchParams.set("filter", "countrycode:tr");
    url.searchParams.set("lang", body.lang === "en" ? "en" : "tr");
    url.searchParams.set("limit", "8");
    url.searchParams.set("format", "json");
    if (inTurkeyish(body.focus)) url.searchParams.set("bias", `proximity:${body.focus.lng},${body.focus.lat}`);
    url.searchParams.set("apiKey", API_KEY);
    const res = await fetch(url);
    if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
    const data = await res.json();
    const results = (data.results ?? []).map((r: any) => {
      const name = r.name || r.address_line1 || r.city || r.formatted;
      return {
        label: r.formatted,
        name,
        region: [r.city && r.city !== name ? r.city : null, r.county, r.state].filter(Boolean).join(", "),
        lng: r.lon,
        lat: r.lat,
      };
    });
    return json({ results });
  }

  if (action === "route") {
    const from = body.from, to = body.to;
    const via: { lat: number; lng: number }[] = Array.isArray(body.via) ? body.via.slice(0, 5) : [];
    if (![from, to, ...via].every(inTurkeyish)) return json({ error: "bad_coordinates" }, 400);
    const { data: allowed } = await admin.rpc("consume_api_quota", { p_user: user.id, p_kind: "route", p_limit: 60 });
    if (!allowed) return json({ error: "quota_exceeded" }, 429);
    const url = new URL(`${BASE}/routing`);
    url.searchParams.set("waypoints", [from, ...via, to].map((p) => `${p.lat},${p.lng}`).join("|"));
    url.searchParams.set("mode", "drive");
    if (body.preference === "shortest") url.searchParams.set("type", "short");
    url.searchParams.set("format", "geojson");
    url.searchParams.set("apiKey", API_KEY);
    const res = await fetch(url);
    if (!res.ok) {
      const detail = await res.text();
      const noRoute = res.status === 400;
      return json({ error: noRoute ? "no_route" : "upstream", status: res.status, detail: detail.slice(0, 300) }, noRoute ? 404 : 502);
    }
    const data = await res.json();
    const feature = data.features?.[0];
    const g = feature?.geometry;
    // Her bacak ayrı çizgi olarak gelir; tek çizgide birleştir
    const coords: LngLat[] = g?.type === "MultiLineString" ? (g.coordinates as LngLat[][]).flat() : g?.type === "LineString" ? g.coordinates : [];
    if (!coords.length) return json({ error: "no_route" }, 404);
    const p = feature.properties ?? {};
    return json({
      distance_m: Math.round(p.distance ?? 0),
      duration_s: Math.round(p.time ?? 0),
      geometry: { type: "LineString", coordinates: coords.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]) },
      simplified: { type: "LineString", coordinates: simplify(coords, 0.002) },
    });
  }

  return json({ error: "unknown_action" }, 400);
});
