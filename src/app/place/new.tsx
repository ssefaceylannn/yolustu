import type { CameraRef } from "@maplibre/maplibre-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { BaseMap } from "@/components/BaseMap";
import { Icon } from "@/components/Icon";
import { Button, Chip, Field, IconButton, Txt } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { catLabel } from "@/lib/format";
import { getCurrentCoords } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { AMENITY_KEYS, USER_ADDABLE, type AmenityKey, type Category } from "@/lib/types";
import { categoryColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

export default function NewPlace() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const camera = useRef<CameraRef>(null);
  const start: [number, number] | null = params.lat && params.lng ? [Number(params.lng), Number(params.lat)] : null;
  const center = useRef<[number, number] | null>(start);
  const [category, setCategory] = useState<Category>("wild_camp");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amenities, setAmenities] = useState<(AmenityKey | "free")[]>([]);
  const [busy, setBusy] = useState(false);

  const useMine = async () => {
    const c = await getCurrentCoords(true);
    if (c) camera.current?.flyTo({ center: [c.lng, c.lat], zoom: 16, duration: 500 });
  };

  const submit = async () => {
    const c = center.current;
    if (!c) return;
    setBusy(true);
    const tags: Record<string, string> = {};
    for (const a of amenities) if (a === "free") tags.fee = "no"; else tags[a] = "yes";
    const { data, error } = await supabase.rpc("add_place", {
      p_category: category, p_name: name.trim(), p_description: description.trim(), p_lat: c[1], p_lng: c[0], p_tags: tags,
    });
    setBusy(false);
    if (error) {
      const m = error.message;
      Alert.alert(t("add.title"), m.includes("rate_limited") ? t("add.rateLimited") : m.includes("outside_turkey") ? t("add.outside") : m.includes("inappropriate") ? t("review.inappropriate") : t("common.error"));
      return;
    }
    Alert.alert(t("add.success"));
    router.replace(`/place/${data}`);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={{ height: 300 }}>
        <BaseMap cameraRef={camera} initialCenter={start ?? undefined} initialZoom={start ? 15 : 5.2}
          onRegionDidChange={(e) => { center.current = e.center; }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ marginBottom: 36 }}><Icon name="pin" size={40} color={colors.accent} weight="bold" /></View>
        </View>
        <View style={{ position: "absolute", right: 12, bottom: 12 }}>
          <IconButton name="locate" label={t("add.useMyLocation")} color={colors.primary} onPress={useMine} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Txt variant="footnote" color="secondary">{t("add.pickLocation")}</Txt>
        <Txt variant="footnoteMedium" color="secondary" style={{ marginTop: 18, marginBottom: 8, textTransform: "uppercase" }}>{t("add.category")}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {USER_ADDABLE.map((c) => <Chip key={c} label={catLabel(t, c)} icon={c} color={categoryColors[c]} selected={category === c} onPress={() => setCategory(c)} />)}
        </View>
        <Field label={t("add.name")} value={name} onChangeText={setName} maxLength={120} />
        <Field label={t("add.description")} value={description} onChangeText={setDescription} placeholder={t("add.descriptionPlaceholder")} multiline maxLength={1000} />
        <Txt variant="footnoteMedium" color="secondary" style={{ marginTop: 18, marginBottom: 8, textTransform: "uppercase" }}>{t("add.amenities")}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["free", ...AMENITY_KEYS] as const).map((a) => (
            <Chip key={a} label={t(`filter.${a}` as TKey)} selected={amenities.includes(a)} onPress={() => setAmenities(amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a])} />
          ))}
        </View>
        <Button title={t("add.submit")} onPress={submit} loading={busy} style={{ marginTop: 28 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
