import { GeoJSONSource, Layer, type CameraRef } from "@maplibre/maplibre-react-native";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BaseMap } from "@/components/BaseMap";
import { BottomSheet } from "@/components/BottomSheet";
import { StopToggle } from "@/components/StopToggle";
import { Icon } from "@/components/Icon";
import { Button, Chip, IconButton, Segmented, shadow, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { openRouteInGoogle } from "@/lib/directions";
import { catLabel, fmtDistance, fmtDuration, placeName } from "@/lib/format";
import { getCurrentCoords, useLastLocation } from "@/lib/location";
import { addRouteStop, MAX_STOPS, removeRouteStop, routeState, samePoint, useStore, type RoutePoint } from "@/lib/store";
import { searchPlaces } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";
import { categoryColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/typography";

type RouteResult = { distance_m: number; duration_s: number; geometry: GeoJSON.LineString; simplified: GeoJSON.LineString };
type AlongPlace = { id: number; category: Category; name: string | null; lat: number; lng: number; rating_avg: number; rating_count: number; distance_from_route_m: number; detour_m: number; route_fraction: number };
type GeoResult = { label: string; name: string; region: string; lat: number; lng: number };

const ALONG: Category[] = ["campsite", "caravan_site", "wild_camp", "viewpoint", "water", "dump_station", "lpg", "beach", "waterfall", "lake", "historic"];

async function callRoute<T>(body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke("route", { body });
  if (error) {
    let code = "error";
    if (error instanceof FunctionsHttpError) { try { code = (await error.context.json()).error ?? code; } catch { /* yok */ } }
    throw new Error(code);
  }
  return data as T;
}

export default function RouteScreen() {
  const { t, fmtNumber, locale } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);
  const state = useStore(routeState);
  const { coords } = useLastLocation();
  const [editing, setEditing] = useState<"from" | "to" | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; rows: GeoResult[] } | null>(null);
  const results = editing && found?.q === query ? found.rows : [];
  const searching = !!editing && query.trim().length >= 2 && found?.q !== query;
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [along, setAlong] = useState<AlongPlace[] | null>(null);
  const [cats, setCats] = useState<Category[]>(["campsite", "caravan_site", "viewpoint", "water"]);
  const [buffer, setBuffer] = useState<"2000" | "5000" | "10000">("5000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopQuery, setStopQuery] = useState("");
  const [stopFound, setStopFound] = useState<{ q: string; rows: Awaited<ReturnType<typeof searchPlaces>> } | null>(null);
  const stopResults = stopQuery.trim().length >= 2 && stopFound?.q === stopQuery ? stopFound.rows : null;
  useEffect(() => {
    if (stopQuery.trim().length < 2) return;
    const h = setTimeout(() => {
      searchPlaces(stopQuery, coords ?? undefined).then((rows) => setStopFound({ q: stopQuery, rows })).catch(() => setStopFound({ q: stopQuery, rows: [] }));
    }, 300);
    return () => clearTimeout(h);
  }, [stopQuery, coords]);
  const planned = useRef<string | null>(null);

  // Adres arama
  useEffect(() => {
    if (!editing || query.trim().length < 2) return;
    const h = setTimeout(() => {
      callRoute<{ results: GeoResult[] }>({ action: "geocode", text: query, lang: locale, focus: coords ?? undefined })
        .then((r) => setFound({ q: query, rows: r.results.filter((x) => Number.isFinite(x.lat)) }))
        .catch(() => setFound({ q: query, rows: [] }));
    }, 350);
    return () => clearTimeout(h);
  }, [query, editing, coords, locale]);

  const choose = (p: RoutePoint) => {
    routeState.set(editing === "from" ? { from: p } : { to: p });
    setEditing(null); setQuery(""); setFound(null); Keyboard.dismiss();
  };

  const chooseMyLocation = async () => {
    const c = await getCurrentCoords(false);
    if (c) choose({ label: t("route.myLocation"), lat: c.lat, lng: c.lng });
  };

  const plan = async () => {
    const { from, to, stops } = routeState.get();
    if (!from || !to) return;
    setBusy(true); setError(null); setAlong(null);
    try {
      const r = await callRoute<RouteResult>({ action: "route", from, to, via: stops });
      setRoute(r);
      planned.current = JSON.stringify([from, to, stops.map((x) => [x.lat, x.lng])]);
      const lngs = r.geometry.coordinates.map((c) => c[0]), lats = r.geometry.coordinates.map((c) => c[1]);
      camera.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { padding: { top: 220 + stops.length * 42, bottom: 80, left: 40, right: 40 }, duration: 600 });
    } catch (e: any) {
      const m = String(e?.message);
      setError(m === "quota_exceeded" ? t("route.quota") : m === "not_configured" ? t("route.notConfigured") : m === "no_route" ? t("route.noRoute") : t("common.error"));
      setRoute(null);
    }
    setBusy(false);
  };

  // Rota üstündeki yerler
  useEffect(() => {
    if (!route) return;
    let alive = true;
    supabase.rpc("places_along_route", { p_route: route.simplified, p_buffer_m: Number(buffer), p_categories: cats.length ? cats : null, p_limit: 150 })
      .then(({ data }) => { if (alive) setAlong((data ?? []) as AlongPlace[]); });
    return () => { alive = false; };
  }, [route, cats, buffer]);

  // Rotaya eklenen duraklar listenin başında durur
  const sortedAlong = useMemo(() => {
    const list = along ?? [];
    const isStop = (a: AlongPlace) => state.stops.some((x) => x.placeId === a.id);
    return [...list.filter(isStop), ...list.filter((a) => !isStop(a))];
  }, [along, state.stops]);
  const lineGeo = useMemo<GeoJSON.FeatureCollection>(() => ({ type: "FeatureCollection", features: route ? [{ type: "Feature", properties: {}, geometry: route.geometry }] : [] }), [route]);
  const pointsGeo = useMemo<GeoJSON.FeatureCollection>(() => {
    const pts = [state.from && { ...state.from, kind: "from" }, ...state.stops.map((s) => ({ ...s, kind: "stop" })), state.to && { ...state.to, kind: "to" }].filter(Boolean) as (RoutePoint & { kind: string })[];
    const alongPts = (along ?? []).map((a) => ({ type: "Feature" as const, properties: { kind: "along", category: a.category, id: a.id, name: placeName(t, a) }, geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] } }));
    return { type: "FeatureCollection", features: [...alongPts, ...pts.map((p) => ({ type: "Feature" as const, properties: { kind: p.kind }, geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] } }))] };
  }, [state, along, t]);
  const colorMatch = ["match", ["get", "category"], ...Object.entries(categoryColors).flat(), colors.primary] as any;

  const toggleAlong = (a: AlongPlace) => {
    const p = { label: placeName(t, a), lat: a.lat, lng: a.lng, placeId: a.id };
    if (state.stops.some((x) => samePoint(x, p))) removeRouteStop(p);
    else if (!addRouteStop(p)) setError(t("route.stopsFull", { n: MAX_STOPS }));
  };

  // Duraklar değişince (harita sekmesinden eklenenler dahil) rotayı yeniden hesapla
  const stopsKey = JSON.stringify([state.from, state.to, state.stops.map((x) => [x.lat, x.lng])]);
  useEffect(() => {
    if (!route || planned.current === null || planned.current === stopsKey) return;
    const h = setTimeout(() => { plan(); }, 400);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, route]);

  const field = (which: "from" | "to") => {
    const p = state[which];
    const active = editing === which;
    return (
      <Pressable testID={`route-${which}`} onPress={() => { setEditing(which); setQuery(""); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 44, paddingHorizontal: 12 }}>
        <View style={{ width: 10, height: 10, borderRadius: which === "from" ? 5 : 2, backgroundColor: which === "from" ? colors.primary : colors.accent }} />
        {active ? (
          <TextInput testID="route-input" autoFocus value={query} onChangeText={setQuery} placeholder={t("route.searchPlaceholder")} placeholderTextColor={colors.textTertiary}
            style={[type.body, { flex: 1, color: colors.text, paddingVertical: 0 }]} autoCorrect={false} />
        ) : (
          <Txt variant="body" numberOfLines={1} color={p ? undefined : "tertiary"} style={{ flex: 1 }}>{p?.label ?? (which === "from" ? t("route.from") : t("route.to"))}</Txt>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <BaseMap cameraRef={camera} onPress={() => setEditing(null)}>
          <GeoJSONSource id="route-line" data={lineGeo}>
            <Layer id="route-casing" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": "#FFFFFF", "line-width": 9 }} />
            <Layer id="route" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": colors.primary, "line-width": 5 }} />
          </GeoJSONSource>
          <GeoJSONSource id="route-points" data={pointsGeo} onPress={(e) => {
            const f = e.nativeEvent.features?.[0] as any;
            if (f?.properties?.kind === "along") router.push(`/place/${f.properties.id}`);
          }}>
            <Layer id="along" type="circle" filter={["==", ["get", "kind"], "along"]} paint={{ "circle-color": colorMatch, "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": "#FFFFFF" }} />
            <Layer id="along-labels" type="symbol" minzoom={11} filter={["==", ["get", "kind"], "along"]}
              layout={{ "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-anchor": "top", "text-offset": [0, 0.9], "text-max-width": 9, "text-optional": true }}
              paint={{ "text-color": colors.text, "text-halo-color": colors.surface, "text-halo-width": 1.6 }} />
            <Layer id="ends" type="circle" filter={["!=", ["get", "kind"], "along"]}
              paint={{ "circle-color": ["match", ["get", "kind"], "from", colors.primary, "to", colors.accent, "#FFFFFF"], "circle-radius": 8, "circle-stroke-width": 3, "circle-stroke-color": ["match", ["get", "kind"], "stop", colors.accent, "#FFFFFF"] }} />
          </GeoJSONSource>
        </BaseMap>

        <View style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12 }}>
          <View style={{ backgroundColor: colors.elevated, borderRadius: radius.lg, ...shadow(2) }}>
            {field("from")}
            <View style={{ height: 0.5, backgroundColor: colors.separator, marginLeft: 32 }} />
            {field("to")}
            <View style={{ position: "absolute", right: 8, top: 26 }}>
              <IconButton name="swap" size={34} label={t("route.swap")} onPress={() => { routeState.set((s) => ({ ...s, from: s.to, to: s.from, stops: [...s.stops].reverse() })); setRoute(null); setAlong(null); }} />
            </View>
          </View>
          {state.stops.length && !editing ? (
            <View style={{ marginTop: 8, backgroundColor: colors.elevated, borderRadius: radius.lg, paddingVertical: 4, ...shadow(2) }}>
              <Txt variant="footnoteMedium" color="secondary" style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2 }}>{t("route.stops")}</Txt>
              {state.stops.map((s, i) => (
                <View key={`${s.lat},${s.lng}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 42, paddingHorizontal: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
                    <Txt variant="captionMedium" style={{ color: "#FFF" }}>{i + 1}</Txt>
                  </View>
                  <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>{s.label}</Txt>
                  <StopToggle added onPress={() => removeRouteStop(s)} size={28} />
                </View>
              ))}
            </View>
          ) : null}
          {editing ? (
            <View style={{ marginTop: 8, backgroundColor: colors.elevated, borderRadius: radius.lg, maxHeight: 340, overflow: "hidden", ...shadow(2) }}>
              <Pressable testID="route-mylocation" onPress={chooseMyLocation} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                <Icon name="locate" size={18} color={colors.primary} />
                <Txt variant="bodyMedium" color="brand">{t("route.myLocation")}</Txt>
              </Pressable>
              {searching ? <ActivityIndicator style={{ padding: 10 }} color={colors.primary} /> : null}
              <FlatList data={results} keyboardShouldPersistTaps="handled" keyExtractor={(r, i) => `${r.label}-${i}`}
                renderItem={({ item }) => (
                  <Pressable testID="geo-result" onPress={() => choose({ label: item.name || item.label, lat: item.lat, lng: item.lng })}
                    style={({ pressed }) => ({ padding: 14, backgroundColor: pressed ? colors.surfaceAlt : "transparent", borderTopWidth: 0.5, borderTopColor: colors.separator })}>
                    <Txt variant="body" numberOfLines={1}>{item.name || item.label}</Txt>
                    {item.region ? <Txt variant="footnote" color="secondary" numberOfLines={1}>{item.region}</Txt> : null}
                  </Pressable>
                )} />
            </View>
          ) : state.from && state.to && !route ? (
            <Button testID="route-plan" title={t("route.plan")} onPress={plan} loading={busy} style={{ marginTop: 10 }} />
          ) : !state.from || !state.to ? (
            <View style={{ marginTop: 10, backgroundColor: colors.elevated, borderRadius: radius.lg, padding: 14, ...shadow(1) }}>
              <Txt variant="subhead" color="secondary">{t("route.hint")}</Txt>
            </View>
          ) : null}
          {error ? <View style={{ marginTop: 10, backgroundColor: colors.elevated, borderRadius: radius.lg, padding: 14 }}><Txt variant="subhead" color="danger">{error}</Txt></View> : null}
        </View>
      </View>

      {route ? (
        <BottomSheet header={
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt testID="route-summary" variant="title3">{t("route.summary", { distance: fmtDistance(t, route.distance_m, fmtNumber), duration: fmtDuration(t, route.duration_s) })}</Txt>
              <Txt variant="caption" color="tertiary">Powered by Geoapify</Txt>
            </View>
            <Button title={t("route.start")} size="medium" icon="directions"
              onPress={() => openRouteInGoogle([state.from!, ...state.stops, state.to!])} />
          </View>}>
          {/* İstediğin yeri ara ve durak ekle (rotaya uzaklığı fark etmez) */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, gap: 8 }}>
              <Icon name="search" size={16} color={colors.textSecondary} />
              <TextInput value={stopQuery} onChangeText={setStopQuery} placeholder={t("route.searchStop")} placeholderTextColor={colors.textTertiary}
                style={[type.body, { flex: 1, color: colors.text, paddingVertical: 0 }]} autoCorrect={false} returnKeyType="search" />
              {stopQuery ? <Pressable hitSlop={10} onPress={() => { setStopQuery(""); Keyboard.dismiss(); }}><Icon name="close" size={14} color={colors.textSecondary} /></Pressable> : null}
            </View>
          </View>
          {stopResults ? (
            <FlatList
              data={stopResults}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(r) => `s${r.id}`}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              ListEmptyComponent={<Txt variant="subhead" color="secondary">{t("route.empty")}</Txt>}
              renderItem={({ item }) => {
                const p = { label: placeName(t, item), lat: item.lat, lng: item.lng, placeId: item.id };
                const added = state.stops.some((x) => samePoint(x, p));
                return (
                  <Pressable onPress={() => router.push(`/place/${item.id}`)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: categoryColors[item.category], alignItems: "center", justifyContent: "center" }}>
                      <Icon name={item.category} size={18} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyMedium" numberOfLines={1}>{p.label}</Txt>
                      <Txt variant="footnote" color="secondary" numberOfLines={1}>{[catLabel(t, item.category), item.province].filter(Boolean).join(" · ")}</Txt>
                    </View>
                    <StopToggle added={added} onPress={() => (added ? removeRouteStop(p) : addRouteStop(p) || setError(t("route.stopsFull", { n: MAX_STOPS })))} />
                  </Pressable>
                );
              }}
            />
          ) : (<>
          {/* Kategoriler ve mesafe ayrı, sabit yükseklikli satırlarda: üst üste binmez */}
          <View style={{ height: 58, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, alignItems: "center", height: 58 }}>
              {ALONG.map((c) => <Chip key={c} size="large" label={catLabel(t, c)} icon={c} color={categoryColors[c]} selected={cats.includes(c)} onPress={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])} />)}
            </ScrollView>
          </View>
          <View style={{ height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.separator }}>
            <Txt variant="footnoteMedium" color="secondary">{t("route.corridor")}</Txt>
            <View style={{ flex: 1 }}>
              <Segmented value={buffer} onChange={setBuffer} options={[{ value: "2000", label: "2 km" }, { value: "5000", label: "5 km" }, { value: "10000", label: "10 km" }]} />
            </View>
          </View>
          <FlatList
            data={sortedAlong}
            keyExtractor={(a) => String(a.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            ListEmptyComponent={along ? <Txt variant="subhead" color="secondary">{t("route.empty")}</Txt> : <ActivityIndicator color={colors.primary} />}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/place/${item.id}`)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: categoryColors[item.category], alignItems: "center", justifyContent: "center" }}>
                  <Icon name={item.category} size={18} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium" numberOfLines={1}>{placeName(t, item)}</Txt>
                  <Txt variant="footnote" color="secondary">
                    {catLabel(t, item.category)} · {item.distance_from_route_m < 500 ? t("route.onRoute") : t("route.detour", { distance: fmtDistance(t, item.detour_m, fmtNumber) })}
                    {" · "}{fmtDistance(t, item.route_fraction * route.distance_m, fmtNumber)}
                  </Txt>
                </View>
                <StopToggle added={state.stops.some((x) => x.placeId === item.id)} onPress={() => toggleAlong(item)} />
              </Pressable>
            )}
          />
          </>)}
        </BottomSheet>
      ) : null}
    </View>
  );
}
