import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Chip, Txt } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { catLabel } from "@/lib/format";
import { mapFilters, useStore } from "@/lib/store";
import { AMENITY_KEYS, CATEGORY_GROUPS, type AmenityKey, type Category } from "@/lib/types";
import { categoryColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

export default function Filters() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const current = useStore(mapFilters);
  const [cats, setCats] = useState<Category[]>(current.categories);
  const [ams, setAms] = useState<(AmenityKey | "free")[]>(current.amenities);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Txt variant="title2">{t("filter.title")}</Txt>
        {CATEGORY_GROUPS.map((g) => (
          <View key={g.key} style={{ marginTop: 20 }}>
            <Txt variant="footnoteMedium" color="secondary" style={{ marginBottom: 8, textTransform: "uppercase" }}>{t(`group.${g.key}` as TKey)}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {g.items.map((c) => <Chip key={c} label={catLabel(t, c)} icon={c} color={categoryColors[c]} selected={cats.includes(c)} onPress={() => setCats(toggle(cats, c))} />)}
            </View>
          </View>
        ))}
        <View style={{ marginTop: 24 }}>
          <Txt variant="footnoteMedium" color="secondary" style={{ marginBottom: 8, textTransform: "uppercase" }}>{t("filter.amenities")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["free", ...AMENITY_KEYS] as const).map((a) => <Chip key={a} label={t(`filter.${a}` as TKey)} selected={ams.includes(a)} onPress={() => setAms(toggle(ams, a))} />)}
          </View>
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 12, padding: 20, paddingBottom: 34, backgroundColor: colors.background }}>
        <Button title={t("filter.reset")} kind="gray" style={{ flex: 1 }} onPress={() => { setCats([]); setAms([]); }} />
        <Button title={t("filter.apply")} style={{ flex: 2 }} onPress={() => { mapFilters.set({ categories: cats, amenities: ams }); router.back(); }} />
      </View>
    </View>
  );
}
