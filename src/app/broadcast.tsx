import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button, Field, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";

export default function BroadcastSheet() {
  const { lat, lng, radius } = useLocalSearchParams<{ lat: string; lng: string; radius: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("send_broadcast", { p_lat: Number(lat), p_lng: Number(lng), p_body: body.trim(), p_radius_km: Number(radius) || 25 });
    setBusy(false);
    if (error) {
      const m = error.message;
      return Alert.alert(t("travelers.broadcast"), m.includes("rate_limited") ? t("travelers.broadcastLimit") : m.includes("inappropriate") ? t("review.inappropriate")
        : m.includes("not_visible") ? t("travelers.broadcastNeedVisible") : /network|fetch/i.test(m) ? t("common.offline") : t("common.error"));
    }
    Alert.alert(t("travelers.broadcast"), data ? t("travelers.broadcastSent", { n: data as number }) : t("travelers.broadcastNoOne"));
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
      <Txt variant="title2">{t("travelers.broadcast")}</Txt>
      <Txt variant="subhead" color="secondary" style={{ marginTop: 6 }}>{t("travelers.broadcastHint")}</Txt>
      <Field value={body} onChangeText={setBody} placeholder={t("travelers.broadcastPlaceholder")} multiline maxLength={500} autoFocus />
      <Button title={t("common.send")} icon="send" onPress={send} loading={busy} disabled={!body.trim()} style={{ marginTop: 20 }} />
    </View>
  );
}
