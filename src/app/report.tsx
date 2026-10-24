import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button, Field, Row, Section, Txt } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";

const REASONS = ["spam", "harassment", "inappropriate", "wrong_info", "dangerous", "other"] as const;

export default function ReportSheet() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    const { error } = await supabase.from("reports").insert({ target_type: type, target_id: String(id), reason, details: details.trim() || null });
    setBusy(false);
    if (error && error.code !== "23505") return Alert.alert(t("common.error"));
    Alert.alert(t("report.title"), error ? t("report.already") : t("report.sent"));
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
      <Txt variant="title2">{t("report.title")}</Txt>
      <Section title={t("report.reason")}>
        {REASONS.map((r, i) => (
          <Row key={r} title={t(`report.${r}` as TKey)} last={i === REASONS.length - 1} onPress={() => setReason(r)}
            right={reason === r ? <Icon name="check" size={20} color={colors.primary} /> : null} />
        ))}
      </Section>
      <Field label={t("report.details")} value={details} onChangeText={setDetails} maxLength={500} />
      <Button title={t("common.send")} onPress={send} disabled={!reason} loading={busy} kind="destructive" style={{ marginTop: 20 }} />
    </View>
  );
}
