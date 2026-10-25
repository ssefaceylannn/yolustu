import { GeoJSONSource, Layer, NativeUserLocation, type CameraRef } from "@maplibre/maplibre-react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BaseMap } from "@/components/BaseMap";
import { Icon } from "@/components/Icon";
import { StopToggle } from "@/components/StopToggle";
import { Chip, IconButton, shadow, Stars, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { placesInBounds, searchPlaces } from "@/lib/api";
import { openDirections } from "@/lib/directions";
import { catLabel, fmtDistance, placeName } from "@/lib/format";
import { distanceMeters, useLastLocation } from "@/lib/location";
import { addRouteStop, mapFilters, MAX_STOPS, removeRouteStop, routeState, useStore, type RoutePoint } from "@/lib/store";
import type { Category, PlacePin } from "@/lib/types";
import { categoryColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/typography";

const QUICK: Category[] = ["campsite", "caravan_site", "water", "dump_station", "lpg", "viewpoint", "beach", "repair"];
const MIN_ZOOM = 7;
const DOUBLE_TAP_MS = 350;
const LIST_HEIGHT = 300;
const nowMs = () => Date.now();

type View4 = { bounds: [number, number, number, number]; zoom: number; center: [number, number] };

export default function MapScreen() {
  const { t, fmtNumber } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);
  const filters = useStore(mapFilters);
  const route = useStore(routeState);
  const { coords, refresh } = useLastLocation();

  const [places, setPlaces] = useState<PlacePin[]>([]);
  const [scanned, setScanned] = useState<View4 | null>(null);
  const [moved, setMoved] = useState(false);
  const [zoom, setZoom] = useState(5);
  const [selected, setSelected] = useState<PlacePin | null>(null);
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; rows: (PlacePin & { province: string | null })[] } | null>(null);
  const results = query.trim().length >= 2 && found?.q === query ? found.rows : null;

  const view = useRef<View4 | null>(null);
  const reqId = useRef(0);
  const centered = useRef(false);
  const autoScanned = useRef(false);
  const quietUntil = useRef(0); // uygulamanın kendi kamera hareketleri "alan değişti" sayılmaz
  const lastTap = useRef<{ id: number; at: number } | null>(null);
  const list = useRef<FlatList<PlacePin>>(null);

  const scan = useCallback(async (v: View4 | null) => {
    if (!v) return;
    if (v.zoom < MIN_ZOOM && filters.categories.length === 0) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const rows = await placesInBounds(v.bounds, filters.categories, filters.amenities, v.zoom < 9 ? 300 : 600);
      if (id !== reqId.current) return;
      const c = { lat: v.center[1], lng: v.center[0] };
      rows.sort((a, b) => distanceMeters(c, a) - distanceMeters(c, b));
      setPlaces(rows);
      setScanned(v);
      setMoved(false);
      setListOpen(true);
    } catch { /* ağ hatası: önceki sonuçlar kalsın */ }
    if (id === reqId.current) setLoading(false);
  }, [filters]);

  // Filtre değişince son taranan alanı yeniden tara
  const lastFilters = useRef(filters);
  useEffect(() => {
    if (lastFilters.current === filters) return;
    lastFilters.current = filters;
    scan(scanned ?? view.current);
  }, [filters, scan, scanned]);

  // İlk açılışta konuma git
  useEffect(() => {
    if (coords && !centered.current) {
      centered.current = true;
      quietUntil.current = nowMs() + 2000;
      camera.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 11, duration: 900 });
    }
  }, [coords]);

  const moveCamera = (center: [number, number], z: number) => {
    quietUntil.current = nowMs() + 1500;
    camera.current?.flyTo({ center, zoom: z, duration: 700 });
  };

  const onRegion = (e: { bounds: [number, number, number, number]; zoom: number; center: [number, number] }) => {
    const v = { bounds: e.bounds, zoom: e.zoom, center: e.center };
    view.current = v;
    setZoom(e.zoom);
    if (!autoScanned.current && centered.current && e.zoom >= MIN_ZOOM) {
      autoScanned.current = true;
      scan(v);
      return;
    }
    if (nowMs() < quietUntil.current) return;
    setMoved(true);
  };

  const pinFeature = (p: PlacePin) => ({
    type: "Feature" as const, id: p.id,
    geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    properties: { id: p.id, category: p.category, name: placeName(t, p) },
  });

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({ type: "FeatureCollection", features: places.map(pinFeature) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, t]);
  const selectedGeo = useMemo<GeoJSON.FeatureCollection>(() => ({ type: "FeatureCollection", features: selected ? [pinFeature(selected)] : [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, t]);
  const stopsGeo = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: route.stops.map((s, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { n: String(i + 1), id: s.placeId ?? null } })),
  }), [route.stops]);

  const colorMatch = useMemo(() => ["match", ["get", "category"], ...Object.entries(categoryColors).flat(), colors.primary] as any, [colors.primary]);

  const toggleQuick = (c: Category) => {
    const has = filters.categories.includes(c);
    mapFilters.set({ categories: has ? filters.categories.filter((x) => x !== c) : [...filters.categories, c] });
  };

  const locate = async () => {
    const c = await refresh(true);
    if (c) camera.current?.flyTo({ center: [c.lng, c.lat], zoom: 12, duration: 700 });
  };

  useEffect(() => {
    if (query.trim().length < 2) return;
    const h = setTimeout(() => {
      searchPlaces(query, coords ?? undefined).then((rows) => setFound({ q: query, rows })).catch(() => setFound({ q: query, rows: [] }));
    }, 300);
    return () => clearTimeout(h);
  }, [query, coords]);

  // Bildirim kısa süre görünür
  useEffect(() => {
    if (!notice) return;
    const h = setTimeout(() => setNotice(null), 1800);
    return () => clearTimeout(h);
  }, [notice]);

  const focus = (p: PlacePin) => {
    setSelected(p);
    moveCamera([p.lng, p.lat], Math.max(view.current?.zoom ?? 13, 13));
  };

  // Haritadaki noktaya dokunma: seç, listede göster
  const pickFromMap = (p: PlacePin) => {
    setSelected(p);
    const i = places.findIndex((x) => x.id === p.id);
    if (listOpen && i >= 0) list.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.3 });
  };

  // Listede tek dokunuş: haritada göster; çift dokunuş: yer sayfası
  const tapRow = (p: PlacePin) => {
    const now = nowMs();
    const prev = lastTap.current;
    lastTap.current = { id: p.id, at: now };
    if (prev && prev.id === p.id && now - prev.at < DOUBLE_TAP_MS) {
      lastTap.current = null;
      router.push(`/place/${p.id}`);
      return;
    }
    focus(p);
  };

  const toPoint = (p: PlacePin): RoutePoint => ({ label: placeName(t, p), lat: p.lat, lng: p.lng, placeId: p.id });
  const inRoute = (p: PlacePin) => route.stops.some((s) => s.placeId === p.id);
  const toggleStop = (p: PlacePin) => {
    Haptics.selectionAsync().catch(() => {});
    if (inRoute(p)) { removeRouteStop(toPoint(p)); return; }
    if (addRouteStop(toPoint(p))) setNotice(t("route.added"));
    else setNotice(t("route.stopsFull", { n: MAX_STOPS }));
  };

  const activeFilterCount = filters.categories.length + filters.amenities.length;
  const zoomTooLow = zoom < MIN_ZOOM && filters.categories.length === 0;
  const showList = !!scanned && listOpen && !results;
  const showPreview = !!selected && !showList && !results;
  const bottomInset = showList ? LIST_HEIGHT + 12 : showPreview ? 168 : 20;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BaseMap cameraRef={camera} onRegionDidChange={onRegion} onPress={() => { setSelected(null); Keyboard.dismiss(); }} attributionBottom={bottomInset - 12}>
        <NativeUserLocation />
        <GeoJSONSource
          id="places"
          data={geojson}
          cluster
          clusterRadius={44}
          clusterMaxZoom={11}
          onPress={(e) => {
            const f = e.nativeEvent.features?.[0];
            if (!f) return;
            const props = f.properties as any;
            if (props?.cluster) {
              const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
              moveCamera([lng, lat], (view.current?.zoom ?? 8) + 2);
            } else {
              const p = places.find((x) => x.id === props?.id);
              if (p) pickFromMap(p);
            }
          }}
        >
          <Layer id="clusters" type="circle" filter={["has", "point_count"]}
            paint={{ "circle-color": colors.primary, "circle-opacity": 0.9, "circle-radius": ["step", ["get", "point_count"], 16, 20, 20, 100, 25], "circle-stroke-width": 3, "circle-stroke-color": colors.surface }} />
          <Layer id="cluster-count" type="symbol" filter={["has", "point_count"]}
            layout={{ "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-allow-overlap": true }}
            paint={{ "text-color": "#FFFFFF" }} />
          <Layer id="place-points" type="circle" filter={["!", ["has", "point_count"]]}
            paint={{ "circle-color": colorMatch, "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 5, 14, 9], "circle-stroke-width": 2, "circle-stroke-color": "#FFFFFF" }} />
          <Layer id="place-labels" type="symbol" minzoom={12} filter={["all", ["!", ["has", "point_count"]], ["!=", ["get", "name"], ""]]}
            layout={{ "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-anchor": "top", "text-offset": [0, 0.9], "text-max-width": 9, "text-optional": true }}
            paint={{ "text-color": colors.text, "text-halo-color": colors.surface, "text-halo-width": 1.6 }} />
        </GeoJSONSource>

        <GeoJSONSource id="route-stops" data={stopsGeo} onPress={(e) => {
          const id = (e.nativeEvent.features?.[0]?.properties as any)?.id;
          const p = places.find((x) => x.id === id);
          if (p) pickFromMap(p);
        }}>
          <Layer id="stop-mark" type="circle" paint={{ "circle-color": colors.accent, "circle-radius": 11, "circle-stroke-width": 2.5, "circle-stroke-color": "#FFFFFF" }} />
          <Layer id="stop-num" type="symbol" layout={{ "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true }} paint={{ "text-color": "#FFFFFF" }} />
        </GeoJSONSource>

        {/* Seçili yer: halkalı büyük işaret + her zaman görünen ad */}
        <GeoJSONSource id="selected-place" data={selectedGeo} onPress={() => { if (selected) router.push(`/place/${selected.id}`); }}>
          <Layer id="sel-halo" type="circle" paint={{ "circle-color": colors.accent, "circle-opacity": 0.22, "circle-radius": 24 }} />
          <Layer id="sel-dot" type="circle" paint={{ "circle-color": colorMatch, "circle-radius": 12, "circle-stroke-width": 4, "circle-stroke-color": colors.accent }} />
          <Layer id="sel-label" type="symbol"
            layout={{ "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 14, "text-anchor": "top", "text-offset": [0, 1.5], "text-max-width": 12, "text-allow-overlap": true, "text-ignore-placement": true }}
            paint={{ "text-color": colors.text, "text-halo-color": colors.surface, "text-halo-width": 2 }} />
        </GeoJSONSource>
      </BaseMap>

      {/* Üst: arama + hızlı filtreler */}
      <View style={{ position: "absolute", top: insets.top + 8, left: 0, right: 0 }}>
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", height: 46, borderRadius: radius.lg, backgroundColor: colors.elevated, paddingHorizontal: 14, gap: 8, ...shadow(2) }}>
            <Icon name="search" size={18} color={colors.textSecondary} />
            <TextInput value={query} onChangeText={setQuery} placeholder={t("map.search")} placeholderTextColor={colors.textTertiary}
              style={[type.body, { flex: 1, color: colors.text, paddingVertical: 0 }]} returnKeyType="search" autoCorrect={false} />
            {query ? <Pressable hitSlop={10} onPress={() => { setQuery(""); Keyboard.dismiss(); }}><Icon name="close" size={16} color={colors.textSecondary} /></Pressable> : null}
          </View>
          <View>
            <IconButton testID="open-filters" name="sliders" size={46} label={t("map.filters")} onPress={() => router.push("/filters")} />
            {activeFilterCount ? (
              <View style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                <Txt variant="captionMedium" style={{ color: "#FFF" }}>{activeFilterCount}</Txt>
              </View>
            ) : null}
          </View>
        </View>

        {results ? (
          <View style={{ marginHorizontal: 12, marginTop: 8, borderRadius: radius.lg, backgroundColor: colors.elevated, maxHeight: 320, overflow: "hidden", ...shadow(2) }}>
            <FlatList
              data={results}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(r) => String(r.id)}
              ListEmptyComponent={<Txt variant="subhead" color="secondary" style={{ padding: 16 }}>{t("route.empty")}</Txt>}
              renderItem={({ item }) => (
                <Pressable onPress={() => { setQuery(""); setFound(null); Keyboard.dismiss(); focus(item); }}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
                  <CatDot category={item.category} size={32} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyMedium" numberOfLines={1}>{placeName(t, item)}</Txt>
                    <Txt variant="footnote" color="secondary" numberOfLines={1}>{[catLabel(t, item.category), item.province].filter(Boolean).join(" · ")}</Txt>
                  </View>
                </Pressable>
              )}
            />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
            {QUICK.map((c) => (
              <Chip key={c} label={catLabel(t, c)} icon={c} color={categoryColors[c]} selected={filters.categories.includes(c)} onPress={() => toggleQuick(c)} />
            ))}
          </ScrollView>
        )}

        {!results ? (
          loading ? (
            <View style={{ alignSelf: "center", backgroundColor: colors.elevated, borderRadius: radius.pill, padding: 8, ...shadow(1) }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : zoomTooLow && (moved || !scanned) ? (
            <View style={{ alignSelf: "center", backgroundColor: colors.elevated, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, ...shadow(1) }}>
              <Txt variant="footnoteMedium">{t("map.zoomIn")}</Txt>
            </View>
          ) : moved || !scanned ? (
            <Pressable testID="scan-area" accessibilityRole="button" onPress={() => scan(view.current)}
              style={({ pressed }) => ({ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 18, height: 40, opacity: pressed ? 0.85 : 1, ...shadow(2) })}>
              <Icon name="scan" size={16} color={colors.primaryText} weight="semibold" />
              <Txt variant="subheadMedium" color="onBrand">{t("map.scanArea")}</Txt>
            </Pressable>
          ) : null
        ) : null}
      </View>

      {notice ? (
        <View pointerEvents="none" style={{ position: "absolute", alignSelf: "center", bottom: bottomInset + 8, backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 }}>
          <Txt variant="footnoteMedium" style={{ color: colors.background }}>{notice}</Txt>
        </View>
      ) : null}

      {/* Sağ üst (arama ve kategorilerin altında): konum + yer ekle (+ liste aç); alttaki listeyle çakışmaz */}
      <View style={{ position: "absolute", right: 12, top: insets.top + 118, gap: 10 }}>
        {scanned && !listOpen ? <IconButton name="list" label={t("map.showList")} onPress={() => setListOpen(true)} /> : null}
        <IconButton name="plus" label={t("map.addPlace")} onPress={() => router.push({ pathname: "/place/new", params: coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {} })} />
        <IconButton name="locate" label={t("map.locate")} color={colors.primary} onPress={locate} />
      </View>

      {showList ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: LIST_HEIGHT, backgroundColor: colors.elevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadow(3) }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Txt testID="area-count" variant="headline">{t("map.inThisArea", { n: fmtNumber(places.length) })}</Txt>
              <Txt variant="caption" color="tertiary">{t("map.tapHint")}</Txt>
            </View>
            <IconButton name="chevronDown" size={34} label={t("map.hideList")} onPress={() => setListOpen(false)} />
          </View>
          <FlatList
            ref={list}
            data={places}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ paddingBottom: 12 }}
            getItemLayout={(_, i) => ({ length: ROW_H, offset: ROW_H * i, index: i })}
            onScrollToIndexFailed={() => {}}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews
            ListEmptyComponent={<Txt variant="subhead" color="secondary" style={{ padding: 16 }}>{t("map.noneInArea")}</Txt>}
            renderItem={({ item }) => (
              <PlaceRow place={item} active={selected?.id === item.id} added={inRoute(item)}
                distance={coords ? fmtDistance(t, distanceMeters(coords, item), fmtNumber) : null}
                onPress={() => tapRow(item)} onToggle={() => toggleStop(item)} />
            )}
          />
        </View>
      ) : null}

      {showPreview && selected ? (
        <PreviewCard place={selected} distance={coords ? distanceMeters(coords, selected) : null} added={inRoute(selected)}
          onOpen={() => router.push(`/place/${selected.id}`)} onToggle={() => toggleStop(selected)}
          onDirections={() => openDirections(t, { lat: selected.lat, lng: selected.lng, label: placeName(t, selected) })}
          distanceText={(m) => fmtDistance(t, m, fmtNumber)} />
      ) : null}
    </View>
  );
}

const ROW_H = 60;

function CatDot({ category, size }: { category: Category; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: categoryColors[category], alignItems: "center", justifyContent: "center" }}>
      <Icon name={category} size={size / 2} color="#FFF" />
    </View>
  );
}

function PlaceRow({ place, active, added, distance, onPress, onToggle }: { place: PlacePin; active: boolean; added: boolean; distance: string | null; onPress: () => void; onToggle: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Pressable testID="place-row" onPress={onPress}
      style={({ pressed }) => ({ height: ROW_H, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16,
        backgroundColor: active ? colors.accent + "1F" : pressed ? colors.surfaceAlt : "transparent",
        borderLeftWidth: 4, borderLeftColor: active ? colors.accent : "transparent" })}>
      <CatDot category={place.category} size={36} />
      <View style={{ flex: 1 }}>
        <Txt variant="bodyMedium" numberOfLines={1}>{placeName(t, place)}</Txt>
        <Txt variant="footnote" color="secondary" numberOfLines={1}>{[catLabel(t, place.category), distance].filter(Boolean).join(" · ")}</Txt>
      </View>
      <StopToggle added={added} onPress={onToggle} />
    </Pressable>
  );
}

function PreviewCard({ place, distance, added, onOpen, onToggle, onDirections, distanceText }: { place: PlacePin; distance: number | null; added: boolean; onOpen: () => void; onToggle: () => void; onDirections: () => void; distanceText: (m: number) => string }) {
  const { t, fmtNumber } = useI18n();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => ({ position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: radius.xl, backgroundColor: colors.elevated, padding: 16, opacity: pressed ? 0.95 : 1, ...shadow(3) })}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <CatDot category={place.category} size={44} />
        <View style={{ flex: 1 }}>
          <Txt variant="headline" numberOfLines={1}>{placeName(t, place)}</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Txt variant="footnote" color="secondary">{catLabel(t, place.category)}</Txt>
            {distance != null ? <Txt variant="footnote" color="secondary">· {distanceText(distance)}</Txt> : null}
          </View>
          {place.rating_count > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Stars value={Number(place.rating_avg)} size={12} />
              <Txt variant="caption" color="secondary">{fmtNumber(Number(place.rating_avg), 1)} ({place.rating_count})</Txt>
            </View>
          ) : null}
        </View>
        <StopToggle added={added} onPress={onToggle} size={36} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Pressable onPress={onDirections} style={({ pressed }) => ({ flex: 1, height: 40, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, opacity: pressed ? 0.8 : 1 })}>
          <Icon name="directions" size={16} color={colors.primaryText} />
          <Txt variant="subheadMedium" color="onBrand">{t("place.directions")}</Txt>
        </Pressable>
        <Pressable onPress={onOpen} style={({ pressed }) => ({ flex: 1, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}>
          <Txt variant="subheadMedium" color="brand">{t("place.info")}</Txt>
        </Pressable>
      </View>
    </Pressable>
  );
}
