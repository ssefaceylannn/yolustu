// Rota ve adres arama (OpenRouteService). Anahtar sunucuda kalır; kişi başı günlük kota uygulanır.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORS_KEY = Deno.env.get("ORS_API_KEY") ?? "";
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
  if (!ORS_KEY) return json({ error: "not_configured" }, 503);

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
    const lang = body.lang === "en" ? "en" : "tr";
    const url = new URL("https://api.openrouteservice.org/geocode/autocomplete");
    url.searchParams.set("text", text);
    url.searchParams.set("boundary.country", "TR");
    url.searchParams.set("size", "8");
    url.searchParams.set("lang", lang);
    if (inTurkeyish(body.focus)) {
      url.searchParams.set("focus.point.lat", String(body.focus.lat));
      url.searchParams.set("focus.point.lon", String(body.focus.lng));
    }
    const res = await fetch(url, { headers: { Authorization: ORS_KEY } });
    if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
    const data = await res.json();
    const results = (data.features ?? []).map((f: any) => ({
      label: f.properties?.label ?? f.properties?.name,
      name: f.properties?.name,
      region: [f.properties?.locality, f.properties?.region].filter(Boolean).join(", "),
      lng: f.geometry?.coordinates?.[0],
      lat: f.geometry?.coordinates?.[1],
    }));
    return json({ results });
  }

  if (action === "route") {
    const from = body.from, to = body.to;
    const via: { lat: number; lng: number }[] = Array.isArray(body.via) ? body.via.slice(0, 5) : [];
    if (![from, to, ...via].every(inTurkeyish)) return json({ error: "bad_coordinates" }, 400);
    const { data: allowed } = await admin.rpc("consume_api_quota", { p_user: user.id, p_kind: "route", p_limit: 60 });
    if (!allowed) return json({ error: "quota_exceeded" }, 429);
    const coordinates = [from, ...via, to].map((p) => [p.lng, p.lat]);
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: { Authorization: ORS_KEY, "Content-Type": "application/json", Accept: "application/geo+json" },
      body: JSON.stringify({ coordinates, instructions: false, preference: body.preference === "shortest" ? "shortest" : "recommended" }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "upstream", status: res.status, detail: detail.slice(0, 300) }, 502);
    }
    const data = await res.json();
    const feature = data.features?.[0];
    const coords: LngLat[] = feature?.geometry?.coordinates ?? [];
    if (!coords.length) return json({ error: "no_route" }, 404);
    const summary = feature.properties?.summary ?? {};
    return json({
      distance_m: Math.round(summary.distance ?? 0),
      duration_s: Math.round(summary.duration ?? 0),
      geometry: { type: "LineString", coordinates: coords.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]) },
      simplified: { type: "LineString", coordinates: simplify(coords, 0.002) },
    });
  }

  return json({ error: "unknown_action" }, 400);
});
