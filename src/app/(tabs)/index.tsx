import { GeoJSONSource, Layer, NativeUserLocation, type CameraRef } from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BaseMap } from "@/components/BaseMap";
import { Icon } from "@/components/Icon";
import { Chip, IconButton, shadow, Stars, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { placesInBounds, searchPlaces } from "@/lib/api";
import { openDirections } from "@/lib/directions";
import { catLabel, fmtDistance, placeName } from "@/lib/format";
import { distanceMeters, useLastLocation } from "@/lib/location";
import { mapFilters, useStore } from "@/lib/store";
import type { Category, PlacePin } from "@/lib/types";
import { categoryColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/typography";

const QUICK: Category[] = ["campsite", "caravan_site", "water", "dump_station", "lpg", "viewpoint", "beach", "repair"];
const MIN_ZOOM = 7;

export default function MapScreen() {
  const { t, fmtNumber } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);
  const filters = useStore(mapFilters);
  const { coords, refresh } = useLastLocation();
  const [places, setPlaces] = useState<PlacePin[]>([]);
  const [selected, setSelected] = useState<PlacePin | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoomTooLow, setZoomTooLow] = useState(true);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; rows: (PlacePin & { province: string | null })[] } | null>(null);
  const results = query.trim().length >= 2 && found?.q === query ? found.rows : null;
  const setResults = (_: null) => setFound(null);
  const view = useRef<{ bounds: [number, number, number, number]; zoom: number } | null>(null);
  const reqId = useRef(0);
  const centered = useRef(false);

  const load = useCallback(async () => {
    const v = view.current;
    if (!v) return;
    const low = v.zoom < MIN_ZOOM && filters.categories.length === 0;
    setZoomTooLow(low);
    if (low) { setPlaces([]); return; }
    const id = ++reqId.current;
    setLoading(true);
    try {
      const rows = await placesInBounds(v.bounds, filters.categories, filters.amenities, v.zoom < 9 ? 300 : 600);
      if (id === reqId.current) setPlaces(rows);
    } catch { /* ağ hatası: mevcut yerler kalsın */ }
    if (id === reqId.current) setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // İlk açılışta konuma git
  useEffect(() => {
    if (coords && !centered.current) {
      centered.current = true;
      camera.current?.flyTo({ center: [coords.lng, coords.lat], zoom: 10, duration: 900 });
    }
  }, [coords]);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRegion = (e: { bounds: [number, number, number, number]; zoom: number }) => {
    view.current = { bounds: e.bounds, zoom: e.zoom };
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(load, 300);
  };

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: places.map((p) => ({ type: "Feature", id: p.id, geometry: { type: "Point", coordinates: [p.lng, p.lat] }, properties: { id: p.id, category: p.category } })),
  }), [places]);

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

  const selectPlace = (p: PlacePin, fly = false) => {
    setSelected(p);
    if (fly) camera.current?.flyTo({ center: [p.lng, p.lat], zoom: 13, duration: 700 });
  };

  const activeFilterCount = filters.categories.length + filters.amenities.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BaseMap cameraRef={camera} onRegionDidChange={onRegion} onPress={() => { setSelected(null); Keyboard.dismiss(); }} attributionBottom={selected ? 150 : 8}>
        <NativeUserLocation />
        <GeoJSONSource
          id="places"
          data={geojson}
          cluster
          clusterRadius={44}
          clusterMaxZoom={12}
          onPress={(e) => {
            const f = e.nativeEvent.features?.[0];
            if (!f) return;
            const props = f.properties as any;
            if (props?.cluster) {
              const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
              camera.current?.easeTo({ center: [lng, lat], zoom: (view.current?.zoom ?? 8) + 2, duration: 400 });
            } else {
              const p = places.find((x) => x.id === props?.id);
              if (p) selectPlace(p);
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
          <Layer id="place-selected" type="circle" filter={["==", ["get", "id"], selected?.id ?? -1]}
            paint={{ "circle-color": "rgba(0,0,0,0)", "circle-radius": 15, "circle-stroke-width": 3, "circle-stroke-color": colors.accent }} />
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
            <IconButton name="sliders" size={46} label={t("map.filters")} onPress={() => router.push("/filters")} />
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
                <Pressable onPress={() => { setQuery(""); setResults(null); Keyboard.dismiss(); selectPlace(item, true); }}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: categoryColors[item.category], alignItems: "center", justifyContent: "center" }}>
                    <Icon name={item.category} size={16} color="#FFF" />
                  </View>
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

        {zoomTooLow && !results ? (
          <View style={{ alignSelf: "center", backgroundColor: colors.elevated, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, ...shadow(1) }}>
            <Txt variant="footnoteMedium">{t("map.zoomIn")}</Txt>
          </View>
        ) : loading ? <ActivityIndicator style={{ alignSelf: "center" }} color={colors.primary} /> : null}
      </View>

      {/* Sağ alt: konum + yer ekle */}
      <View style={{ position: "absolute", right: 12, bottom: selected ? 168 : 20, gap: 10 }}>
        <IconButton name="plus" label={t("map.addPlace")} onPress={() => router.push({ pathname: "/place/new", params: coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {} })} />
        <IconButton name="locate" label={t("map.locate")} color={colors.primary} onPress={locate} />
      </View>

      {selected ? (
        <PreviewCard place={selected} distance={coords ? distanceMeters(coords, selected) : null} onOpen={() => router.push(`/place/${selected.id}`)}
          onDirections={() => openDirections(t, { lat: selected.lat, lng: selected.lng, label: placeName(t, selected) })}
          distanceText={(m) => fmtDistance(t, m, fmtNumber)} />
      ) : null}
    </View>
  );
}

function PreviewCard({ place, distance, onOpen, onDirections, distanceText }: { place: PlacePin; distance: number | null; onOpen: () => void; onDirections: () => void; distanceText: (m: number) => string }) {
  const { t, fmtNumber } = useI18n();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => ({ position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: radius.xl, backgroundColor: colors.elevated, padding: 16, opacity: pressed ? 0.95 : 1, ...shadow(3) })}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: categoryColors[place.category], alignItems: "center", justifyContent: "center" }}>
          <Icon name={place.category} size={22} color="#FFF" />
        </View>
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
        <Icon name="chevronRight" size={16} color={colors.textTertiary} />
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
