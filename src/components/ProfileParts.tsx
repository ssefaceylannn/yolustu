import { Image } from "expo-image";
import { View } from "react-native";
import { useI18n, type TKey } from "@/i18n";
import { publicUrl } from "@/lib/media";
import type { Stats } from "@/lib/types";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "./ui";

export function Avatar({ path, name, size = 72 }: { path: string | null; name: string; size?: number }) {
  const { colors } = useTheme();
  if (path) return <Image source={{ uri: publicUrl("avatars", path) }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
      <Txt variant="title1" color="brand" style={{ fontSize: size * 0.42, lineHeight: size * 0.5 }}>{name.slice(0, 1).toLocaleUpperCase("tr")}</Txt>
    </View>
  );
}

export function StatsRow({ stats }: { stats: Stats | null }) {
  const { t, fmtNumber } = useI18n();
  const items: [number, TKey][] = [[stats?.checkins ?? 0, "profile.checkins"], [stats?.provinces ?? 0, "profile.provinces"], [stats?.km ?? 0, "profile.km"], [stats?.badges ?? 0, "profile.badges"]];
  return (
    <View style={{ flexDirection: "row", marginTop: 16 }}>
      {items.map(([v, k]) => (
        <View key={k} style={{ flex: 1, alignItems: "center" }}>
          <Txt variant="title3">{fmtNumber(v)}</Txt>
          <Txt variant="caption" color="secondary">{t(k)}</Txt>
        </View>
      ))}
    </View>
  );
}

