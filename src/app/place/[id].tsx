import { Image } from "expo-image";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/Icon";
import { Card, EmptyState, IconButton, Loading, shadow, Stars, Txt } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { getPlace } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CHECKIN_RADIUS_M } from "@/lib/config";
import { openDirections } from "@/lib/directions";
import { catLabel, fmtDistance, placeName, relTime } from "@/lib/format";
import { getCurrentCoords, distanceMeters } from "@/lib/location";
import { pickImage, publicUrl, uploadImage } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import type { Photo, Place, Review } from "@/lib/types";
import { fetchWeather, weatherVisual, type Weather } from "@/lib/weather";
import { categoryColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/typography";

type ReviewWithUser = Review & { username?: string; display_name?: string | null };

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const placeId = Number(id);
  const { t, fmtNumber, locale } = useI18n();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [weather, setWeather] = useState<Weather | null | "error">(null);
  const [busy, setBusy] = useState<null | "checkin" | "photo">(null);

  const loadAll = useCallback(async () => {
    try {
      const p = await getPlace(placeId);
      setPlace(p);
      const [ph, rv] = await Promise.all([
        supabase.from("place_photos").select("*").eq("place_id", placeId).order("created_at", { ascending: false }).limit(30),
        supabase.from("place_reviews").select("*").eq("place_id", placeId).order("created_at", { ascending: false }).limit(50),
      ]);
      setPhotos((ph.data ?? []) as Photo[]);
      const rows = (rv.data ?? []) as Review[];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const profs = ids.length ? (await supabase.from("profiles").select("id, username, display_name").in("id", ids)).data ?? [] : [];
      const byId = new Map(profs.map((x: any) => [x.id, x]));
      setReviews(rows.map((r) => ({ ...r, username: byId.get(r.user_id)?.username, display_name: byId.get(r.user_id)?.display_name })));
    } catch {
      setPlace((cur) => (cur === undefined ? null : cur));
    }
  }, [placeId]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  useEffect(() => {
    if (!place) return;
    fetchWeather(place.lat, place.lng).then(setWeather).catch(() => setWeather("error"));
  }, [place?.lat, place?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (place === undefined) return <View style={{ flex: 1, backgroundColor: colors.background }}><Stack.Screen options={{ title: "" }} /><Loading /></View>;
  if (place === null) return <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 120 }}><EmptyState icon="pin" title={t("common.error")} /></View>;

  const name = placeName(t, place);
  const color = categoryColors[place.category] ?? colors.primary;
  const myReview = reviews.find((r) => r.user_id === userId);

  const checkIn = async () => {
    setBusy("checkin");
    try {
      const c = await getCurrentCoords(true);
      if (!c) { Alert.alert(t("place.checkIn"), t("map.noLocation")); return; }
      const { data, error } = await supabase.rpc("check_in", { p_place: placeId, p_lat: c.lat, p_lng: c.lng });
      if (error) throw error;
      const r = data as { ok: boolean; reason?: string; distance_m?: number; first?: boolean; new_badges?: string[] };
      if (!r.ok) {
        const msg = r.reason === "too_far"
          ? t("place.checkInTooFar", { radius: CHECKIN_RADIUS_M, distance: fmtDistance(t, r.distance_m ?? distanceMeters(c, place), fmtNumber) })
          : t("place.checkInAlready");
        Alert.alert(t("place.checkIn"), msg);
        return;
      }
      const badges = (r.new_badges ?? []).map((b) => t(`badge.${b}` as TKey)).join(", ");
      Alert.alert(r.first ? t("place.checkInFirst") : t("place.checkInDone"), badges ? t("place.newBadges", { badges }) : undefined);
      loadAll();
    } catch {
      Alert.alert(t("common.error"));
    } finally { setBusy(null); }
  };

  const addPhoto = () => {
    const run = async (src: "camera" | "library") => {
      const uri = await pickImage(src);
      if (!uri || !userId) return;
      setBusy("photo");
      try {
        const up = await uploadImage("place-photos", `${userId}/${placeId}`, uri);
        const { error } = await supabase.from("place_photos").insert({ place_id: placeId, path: up.path, width: up.width, height: up.height });
        if (error) throw error;
        loadAll();
      } catch { Alert.alert(t("common.error")); } finally { setBusy(null); }
    };
    const camera = locale === "tr" ? "Fotoğraf çek" : "Take photo";
    const library = locale === "tr" ? "Galeriden seç" : "Choose from library";
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: [camera, library, t("common.cancel")], cancelButtonIndex: 2 }, (i) => { if (i === 0) run("camera"); if (i === 1) run("library"); });
    } else {
      Alert.alert(t("place.addPhoto"), undefined, [{ text: camera, onPress: () => run("camera") }, { text: library, onPress: () => run("library") }, { text: t("common.cancel"), style: "cancel" }]);
    }
  };

  const share = () => {
    Share.share({ message: `${name} · ${catLabel(t, place.category)}\nhttps://www.google.com/maps?q=${place.lat},${place.lng}\n— Yolüstü` }).catch(() => {});
  };

  const report = (type: "place" | "review" | "photo", targetId: string) => router.push({ pathname: "/report", params: { type, id: targetId } });

  const amenityChips: { key: string; icon: IconName; label: string }[] = [];
  const tg = place.tags ?? {};
  if (tg.fee === "no") amenityChips.push({ key: "fee", icon: "heart", label: t("place.fee.no") });
  if (tg.fee === "yes") amenityChips.push({ key: "fee", icon: "info", label: t("place.fee.yes") });
  if (tg.electricity === "yes") amenityChips.push({ key: "el", icon: "ev_charging", label: t("filter.electricity") });
  if (tg.water === "yes") amenityChips.push({ key: "wa", icon: "water", label: t("filter.water") });
  if (tg.shower === "yes") amenityChips.push({ key: "sh", icon: "shower", label: t("filter.shower") });
  if (tg.toilet === "yes") amenityChips.push({ key: "to", icon: "toilet", label: t("filter.toilet") });
  if (tg.wifi === "yes") amenityChips.push({ key: "wi", icon: "antenna", label: t("filter.wifi") });
  if (tg.dogs === "yes") amenityChips.push({ key: "do", icon: "heart", label: t("filter.dogs") });

  const info: { icon: IconName; label: string; value: string; onPress?: () => void }[] = [];
  if (tg.phone) info.push({ icon: "phone", label: t("place.phone"), value: tg.phone, onPress: () => Linking.openURL(`tel:${tg.phone.replace(/\s/g, "")}`) });
  if (tg.website) info.push({ icon: "globe", label: t("place.website"), value: tg.website.replace(/^https?:\/\//, ""), onPress: () => Linking.openURL(tg.website.startsWith("http") ? tg.website : `https://${tg.website}`) });
  if (tg.opening_hours) info.push({ icon: "clock", label: t("place.hours"), value: tg.opening_hours });
  if (tg.ele) info.push({ icon: "peak", label: t("place.elevation"), value: `${tg.ele} m` });
  if (tg.brand) info.push({ icon: "car_dealer", label: t("place.brand"), value: tg.brand });
  if (tg.operator && tg.operator !== tg.brand) info.push({ icon: "info", label: t("place.operator"), value: tg.operator });

  const hero = photos[0];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{
        title: "",
        headerTransparent: true,
        headerRight: () => (
          <IconButton name="flag" size={34} label={t("common.report")} onPress={() => report("place", String(place.id))} />
        ),
      }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {hero ? (
          <Image source={{ uri: publicUrl("place-photos", hero.path) }} style={{ height: 280 }} contentFit="cover" transition={200} />
        ) : (
          <View style={{ height: 220, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
            <Icon name={place.category} size={72} color="rgba(255,255,255,0.9)" />
          </View>
        )}

        <View style={{ paddingHorizontal: 16, marginTop: -28 }}>
          <Card style={{ ...shadow(2) }}>
            <Txt variant="footnoteMedium" style={{ color }}>{catLabel(t, place.category).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}</Txt>
            <Txt variant="title2" style={{ marginTop: 4 }}>{name}</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {place.rating_count > 0 ? (
                <>
                  <Stars value={Number(place.rating_avg)} />
                  <Txt variant="footnote" color="secondary">{t("place.rating", { rating: fmtNumber(Number(place.rating_avg), 1), n: place.rating_count })}</Txt>
                </>
              ) : null}
              {place.checkin_count > 0 ? <Txt variant="footnote" color="secondary">· {t("place.checkins", { n: place.checkin_count })}</Txt> : null}
            </View>
            {place.description ? <Txt variant="body" style={{ marginTop: 12 }}>{place.description}</Txt> : null}

            <View style={{ flexDirection: "row", marginTop: 16, gap: 8 }}>
              <Action icon="directions" label={t("place.directions")} primary onPress={() => openDirections(t, { lat: place.lat, lng: place.lng, label: name })} />
              <Action icon="checkin" label={t("place.checkIn")} loading={busy === "checkin"} onPress={checkIn} />
              <Action icon="camera" label={t("place.addPhoto")} loading={busy === "photo"} onPress={addPhoto} />
              <Action icon="share" label={t("common.share")} onPress={share} />
            </View>
          </Card>
        </View>

        {/* Hava durumu */}
        <SectionTitle title={t("place.weather")} />
        <View style={{ paddingHorizontal: 16 }}>
          <Card>
            {weather === null ? <Loading /> : weather === "error" ? <Txt variant="subhead" color="secondary">{t("weather.unavailable")}</Txt> : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Icon name={weatherVisual(weather.now.symbol).icon} size={44} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="title1">{weather.now.temp}°</Txt>
                    <Txt variant="subhead" color="secondary">{t(weatherVisual(weather.now.symbol).label)}</Txt>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Txt variant="footnote" color="secondary">{t("weather.wind", { n: weather.now.windKmh })}</Txt>
                    {weather.now.precipMm > 0 ? <Txt variant="footnote" color="secondary">{t("weather.rain", { n: fmtNumber(weather.now.precipMm, 1) })}</Txt> : null}
                  </View>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
                  {weather.days.map((d) => (
                    <View key={d.date} style={{ alignItems: "center", gap: 4, flex: 1 }}>
                      <Txt variant="caption" color="secondary">{new Date(d.date + "T12:00:00").toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { weekday: "short" })}</Txt>
                      <Icon name={weatherVisual(d.symbol).icon} size={22} color={colors.textSecondary} />
                      <Txt variant="footnoteMedium">{d.max}°</Txt>
                      <Txt variant="caption" color="tertiary">{d.min}°</Txt>
                    </View>
                  ))}
                </View>
                <Txt variant="caption" color="tertiary" style={{ marginTop: 12 }}>{t("place.weatherSource")}</Txt>
              </>
            )}
          </Card>
        </View>

        {amenityChips.length ? (
          <>
            <SectionTitle title={t("place.amenities")} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 }}>
              {amenityChips.map((a) => (
                <View key={a.key} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, height: 34 }}>
                  <Icon name={a.icon} size={15} color={colors.primary} />
                  <Txt variant="subhead">{a.label}</Txt>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {info.length ? (
          <>
            <SectionTitle title={t("place.info")} />
            <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" }}>
              {info.map((row, i) => (
                <Pressable key={row.label} disabled={!row.onPress} onPress={row.onPress}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                    borderBottomWidth: i === info.length - 1 ? 0 : 0.5, borderBottomColor: colors.separator })}>
                  <Icon name={row.icon} size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="caption" color="secondary">{row.label}</Txt>
                    <Txt variant="body" style={{ color: row.onPress ? colors.primary : colors.text }} numberOfLines={2}>{row.value}</Txt>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* Fotoğraflar */}
        {photos.length ? (
          <>
            <SectionTitle title={t("place.photos")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {photos.map((p) => (
                <Pressable key={p.id} onLongPress={() => p.user_id === userId
                  ? Alert.alert(t("common.delete"), undefined, [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: async () => {
                      await supabase.storage.from("place-photos").remove([p.path]);
                      await supabase.from("place_photos").delete().eq("id", p.id);
                      loadAll();
                    } }])
                  : report("photo", p.id)}>
                  <Image source={{ uri: publicUrl("place-photos", p.path) }} style={{ width: 150, height: 150, borderRadius: radius.md }} contentFit="cover" transition={150} />
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Yorumlar */}
        <SectionTitle title={t("place.reviews")} action={myReview ? t("place.editReview") : t("place.writeReview")}
          onAction={() => router.push({ pathname: "/review", params: { placeId: String(placeId), name } })} />
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {reviews.length === 0 ? <Txt variant="subhead" color="secondary">{t("place.noReviews")}</Txt> : reviews.map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable style={{ flex: 1 }} onPress={() => r.user_id !== userId && router.push(`/user/${r.user_id}`)}>
                  <Txt variant="subheadMedium">{r.display_name || (r.username ? `@${r.username}` : "")}</Txt>
                </Pressable>
                <Txt variant="caption" color="tertiary">{relTime(r.created_at, locale)}</Txt>
                {r.user_id !== userId ? (
                  <Pressable hitSlop={10} onPress={() => report("review", r.id)} accessibilityLabel={t("common.report")}>
                    <Icon name="more" size={18} color={colors.textTertiary} />
                  </Pressable>
                ) : null}
              </View>
              <Stars value={r.rating} size={13} />
              {r.body ? <Txt variant="body" style={{ marginTop: 8 }}>{r.body}</Txt> : null}
            </Card>
          ))}
        </View>

        <Txt variant="caption" color="tertiary" style={{ textAlign: "center", marginTop: 24 }}>
          {place.source === "osm" ? `${t("place.osm")} · © OpenStreetMap` : t("place.addedByUser")}
        </Txt>
      </ScrollView>
    </View>
  );
}

function Action({ icon, label, onPress, primary, loading }: { icon: IconName; label: string; onPress: () => void; primary?: boolean; loading?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={loading}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: radius.md,
        backgroundColor: primary ? colors.primary : colors.primarySoft, opacity: pressed || loading ? 0.7 : 1 })}>
      <Icon name={icon} size={20} color={primary ? colors.primaryText : colors.primary} />
      <Txt variant="captionMedium" numberOfLines={1} style={{ color: primary ? colors.primaryText : colors.primary }}>{label}</Txt>
    </Pressable>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", paddingHorizontal: 20, marginTop: 28, marginBottom: 10 }}>
      <Txt variant="title3" style={{ flex: 1 }}>{title}</Txt>
      {action ? <Txt variant="subheadMedium" color="brand" onPress={onAction}>{action}</Txt> : null}
    </View>
  );
}
