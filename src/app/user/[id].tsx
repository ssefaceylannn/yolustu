import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, useWindowDimensions, View } from "react-native";
import { Avatar, StatsRow } from "@/components/ProfileParts";
import { TurkeyMap, type ProvinceShapes } from "@/components/TurkeyMap";
import { Button, Card, EmptyState, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { loadProvinceShapes, loadVisited } from "@/lib/provinces";
import { supabase } from "@/lib/supabase";
import type { Profile, Stats } from "@/lib/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [shapes, setShapes] = useState<ProvinceShapes | null>(null);
  const [visited, setVisited] = useState<Set<number>>(new Set());

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", id).maybeSingle().then(({ data }) => setProfile(data as Profile));
    supabase.rpc("profile_stats", { p_user: id }).then(({ data }) => setStats(data as Stats | null));
    loadProvinceShapes().then(setShapes);
    loadVisited(id).then(setVisited);
  }, [id]);

  if (!profile) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  const display = profile.display_name || profile.username;

  const block = () => Alert.alert(t("common.block"), t("chat.blockConfirm", { username: profile.username }), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("common.block"), style: "destructive", onPress: async () => { await supabase.from("blocks").insert({ blocked_id: profile.id }); Alert.alert(t("chat.blockedDone")); } },
  ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: `@${profile.username}` }} />
      <Card style={{ alignItems: "center", gap: 6 }}>
        <Avatar path={profile.avatar_path} name={display} size={88} />
        <Txt variant="title2">{display}</Txt>
        <Txt variant="subhead" color="secondary">@{profile.username}</Txt>
        {profile.bio ? <Txt variant="body" style={{ textAlign: "center", marginTop: 6 }}>{profile.bio}</Txt> : null}
        {stats ? <StatsRow stats={stats} /> : null}
      </Card>
      {stats && shapes ? (
        <Card style={{ marginTop: 12 }}>
          <TurkeyMap shapes={shapes} visited={visited} width={width - 64} />
          <Txt variant="footnote" color="secondary" style={{ textAlign: "center", marginTop: 8 }}>{t("badges.provinces", { n: visited.size })}</Txt>
        </Card>
      ) : !stats ? <EmptyState icon="lock" title={t("profile.private")} /> : null}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
        <Button title={t("common.report")} kind="gray" size="medium" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/report", params: { type: "user", id: profile.id } })} />
        <Button title={t("common.block")} kind="destructive" size="medium" style={{ flex: 1 }} onPress={block} />
      </View>
    </ScrollView>
  );
}
