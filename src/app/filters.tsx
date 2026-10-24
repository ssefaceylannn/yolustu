import { router } from "expo-router";
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
  // Seçimler anında uygulanır (yarım açılan sayfada alttaki düğme görünmeyebiliyordu)
  const { categories: cats, amenities: ams } = useStore(mapFilters);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const setCats = (categories: Category[]) => mapFilters.set({ categories });
  const setAms = (amenities: (AmenityKey | "free")[]) => mapFilters.set({ amenities });
  const count = cats.length + ams.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt variant="title2" style={{ flex: 1 }}>{t("filter.title")}</Txt>
          {count ? <Button title={t("filter.reset")} kind="plain" size="medium" onPress={() => mapFilters.set({ categories: [], amenities: [] })} /> : null}
          <Button testID="filters-done" title={t("common.done")} kind="tinted" size="medium" onPress={() => router.back()} />
        </View>
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
    </View>
  );
}
