import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Avatar, StatsRow } from "@/components/ProfileParts";
import { LargeTitle, Row, Section, Txt } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { catLabel, placeName, relTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Category, Stats, Vehicle } from "@/lib/types";
import { categoryColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";
import { radius } from "@/theme/typography";

type Recent = { id: string; created_at: string; place_id: number; name: string | null; category: Category };

export default function ProfileScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const { profile, userId } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    supabase.rpc("profile_stats").then(({ data }) => setStats(data as Stats));
    supabase.from("vehicles").select("*").eq("user_id", userId).order("is_primary", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setVehicle(data as Vehicle | null));
    supabase.from("checkins").select("id, created_at, place_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(10).then(async ({ data }) => {
      const ids = [...new Set((data ?? []).map((c) => c.place_id))];
      const { data: pl } = ids.length ? await supabase.from("places").select("id, name, category").in("id", ids) : { data: [] as any[] };
      const byId = new Map((pl ?? []).map((p: any) => [p.id, p]));
      setRecent((data ?? []).filter((c) => byId.has(c.place_id)).map((c) => ({ ...c, name: byId.get(c.place_id).name, category: byId.get(c.place_id).category })));
    });
  }, [userId]));

  if (!profile) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  const display = profile.display_name || profile.username;
  const vehicleText = vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || t(`kind.${vehicle.kind}` as TKey) : t("profile.noVehicle");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
      <LargeTitle title={t("profile.title")} right={
        <Pressable hitSlop={10} onPress={() => router.push("/settings")} accessibilityLabel={t("profile.settings")}><Icon name="settings" size={24} color={colors.primary} /></Pressable>
      } />
      <Pressable onPress={() => router.push("/profile-edit")} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar path={profile.avatar_path} name={display} />
          <View style={{ flex: 1 }}>
            <Txt variant="title3">{display}</Txt>
            <Txt variant="subhead" color="secondary">@{profile.username}</Txt>
            {profile.bio ? <Txt variant="footnote" style={{ marginTop: 6 }} numberOfLines={3}>{profile.bio}</Txt> : null}
          </View>
          <Icon name="chevronRight" size={14} color={colors.textTertiary} />
        </View>
        <StatsRow stats={stats} />
      </Pressable>

      <Section>
        <Row icon="car" iconColor="#5B5F97" title={t("profile.vehicle")} value={vehicleText} chevron onPress={() => router.push("/vehicle")} />
        <Row icon="wrench" iconColor="#B5562F" title={t("profile.services")} chevron onPress={() => router.push("/services")} />
        <Row icon="checklist" iconColor="#2E7D57" title={t("profile.checklist")} chevron last onPress={() => router.push("/checklist")} />
      </Section>

      {recent.length ? (
        <Section title={t("profile.recent")}>
          {recent.map((r, i) => (
            <Row key={r.id} icon={r.category} iconColor={categoryColors[r.category]} title={placeName(t, r)} subtitle={`${catLabel(t, r.category)} · ${relTime(r.created_at, locale)}`}
              chevron last={i === recent.length - 1} onPress={() => router.push(`/place/${r.place_id}`)} />
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}
