import * as Sharing from "expo-sharing";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, useWindowDimensions, View, type HostInstance } from "react-native";
import { captureRef } from "react-native-view-shot";
import { Icon } from "@/components/Icon";
import { TurkeyMap, type ProvinceShapes } from "@/components/TurkeyMap";
import { Button, Card, LargeTitle, Txt } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { BADGES, FAMILY_COLORS, type BadgeDef } from "@/lib/badges";
import { fmtDate } from "@/lib/format";
import { loadProvinceShapes, loadVisited } from "@/lib/provinces";
import { supabase } from "@/lib/supabase";
import type { Stats } from "@/lib/types";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/typography";

export default function BadgesScreen() {
  const { t, fmtNumber, locale } = useI18n();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [shapes, setShapes] = useState<ProvinceShapes | null>(null);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [earned, setEarned] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState<Stats | null>(null);
  const [open, setOpen] = useState<BadgeDef | null>(null);
  const shareCard = useRef<HostInstance>(null);
  const badgeCard = useRef<HostInstance>(null);

  useFocusEffect(useCallback(() => {
    loadProvinceShapes().then(setShapes);
    loadVisited().then(setVisited);
    supabase.from("user_badges").select("badge, earned_at").eq("user_id", profile?.id ?? "").then(({ data }) => {
      setEarned(new Map((data ?? []).map((b: any) => [b.badge, b.earned_at])));
    });
    supabase.rpc("profile_stats").then(({ data }) => setStats(data as Stats));
  }, [profile?.id]));

  const share = async (ref: React.RefObject<HostInstance | null>) => {
    try {
      const uri = await captureRef(ref, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch { /* paylaşım iptal */ }
  };

  const mapWidth = width - 32 - 32;
  const groups: { title: string; items: BadgeDef[] }[] = [
    { title: t("badges.earned"), items: BADGES.filter((b) => earned.has(b.id)) },
    { title: t("badges.locked"), items: BADGES.filter((b) => !earned.has(b.id)) },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
      <LargeTitle title={t("badges.title")} subtitle={t("badges.provinces", { n: visited.size })} />

      <View ref={shareCard} collapsable={false} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, marginTop: 12 }}>
        {shapes ? <TurkeyMap shapes={shapes} visited={visited} width={mapWidth} /> : <View style={{ height: mapWidth * 0.43 }} />}
        <View style={{ flexDirection: "row", marginTop: 14 }}>
          {[
            [String(visited.size), t("profile.provinces")],
            [fmtNumber(stats?.checkins ?? 0), t("profile.checkins")],
            [fmtNumber(stats?.km ?? 0), t("profile.km")],
            [String(earned.size), t("profile.badges")],
          ].map(([v, l]) => (
            <View key={l} style={{ flex: 1, alignItems: "center" }}>
              <Txt variant="title3">{v}</Txt>
              <Txt variant="caption" color="secondary">{l}</Txt>
            </View>
          ))}
        </View>
        <Txt variant="captionMedium" color="brand" style={{ textAlign: "center", marginTop: 12 }}>Yolüstü{profile ? ` · @${profile.username}` : ""}</Txt>
      </View>
      <Button title={t("badges.shareMap")} kind="tinted" icon="share" size="medium" onPress={() => share(shareCard)} style={{ marginTop: 12 }} />

      {earned.size === 0 ? <Txt variant="subhead" color="secondary" style={{ marginTop: 24, textAlign: "center" }}>{t("badges.empty")}</Txt> : null}

      {groups.filter((g) => g.items.length).map((g) => (
        <View key={g.title} style={{ marginTop: 28 }}>
          <Txt variant="title3" style={{ marginBottom: 12 }}>{g.title}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {g.items.map((b) => {
              const has = earned.has(b.id);
              const size = (width - 32 - 24) / 3;
              return (
                <Pressable key={b.id} onPress={() => setOpen(b)} style={({ pressed }) => ({ width: size, alignItems: "center", gap: 8, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 })}>
                  <Medal def={b} earned={has} size={56} />
                  <Txt variant="footnoteMedium" numberOfLines={2} style={{ textAlign: "center", paddingHorizontal: 6 }} color={has ? undefined : "tertiary"}>{t(`badge.${b.id}` as TKey)}</Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: 32 }} onPress={() => setOpen(null)}>
          {open ? (
            <Pressable onPress={() => {}}>
              <View ref={badgeCard} collapsable={false}>
                <Card style={{ alignItems: "center", paddingVertical: 28, gap: 10 }}>
                  <Medal def={open} earned={earned.has(open.id)} size={96} />
                  <Txt variant="title2" style={{ textAlign: "center" }}>{t(`badge.${open.id}` as TKey)}</Txt>
                  <Txt variant="body" color="secondary" style={{ textAlign: "center" }}>
                    {open.family === "region" ? t("badge.region.d") : t(`badge.${open.id}.d` as TKey)}
                  </Txt>
                  {earned.has(open.id) ? <Txt variant="footnote" color="tertiary">{fmtDate(earned.get(open.id)!, locale)}</Txt> : null}
                  <Txt variant="captionMedium" color="brand">Yolüstü{profile ? ` · @${profile.username}` : ""}</Txt>
                </Card>
              </View>
              {earned.has(open.id) ? <Button title={t("badges.shareBadge")} icon="share" onPress={() => share(badgeCard)} style={{ marginTop: 12 }} /> : null}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Medal({ def, earned, size }: { def: BadgeDef; earned: boolean; size: number }) {
  const { colors } = useTheme();
  const c = earned ? FAMILY_COLORS[def.family] : colors.surfaceAlt;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, alignItems: "center", justifyContent: "center",
      borderWidth: size * 0.06, borderColor: earned ? colors.accentSoft : colors.separator }}>
      <Icon name={earned ? def.icon : "lock"} size={size * 0.42} color={earned ? "#FFFFFF" : colors.textTertiary} />
    </View>
  );
}
