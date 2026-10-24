import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { Button, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";

function CheckRow({ checked, onToggle, text, onRead, readLabel }: { checked: boolean; onToggle: () => void; text: string; onRead: () => void; readLabel: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} hitSlop={10}>
        <Icon name={checked ? "check" : "circle"} size={26} color={checked ? colors.primary : colors.textTertiary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Txt variant="body" onPress={onToggle}>{text}</Txt>
        <Txt variant="subheadMedium" color="brand" onPress={onRead} style={{ marginTop: 4 }}>{readLabel}</Txt>
      </View>
    </View>
  );
}

export default function Consent() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { updateSettings } = useAuth();
  const insets = useSafeAreaInsets();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    try { await updateSettings({ terms_accepted_at: now, privacy_ack_at: now }); } catch { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <Icon name="lock" size={44} color={colors.primary} />
      <Txt variant="title1" style={{ marginTop: 16 }}>{t("consent.title")}</Txt>
      <Txt variant="body" color="secondary" style={{ marginTop: 10 }}>{t("consent.body")}</Txt>
      <View style={{ marginTop: 24 }}>
        <CheckRow checked={terms} onToggle={() => setTerms(!terms)} text={t("consent.terms")} onRead={() => router.push("/legal/terms")} readLabel={t("consent.read")} />
        <CheckRow checked={privacy} onToggle={() => setPrivacy(!privacy)} text={t("consent.privacy")} onRead={() => router.push("/legal/kvkk")} readLabel={t("consent.read")} />
      </View>
      <View style={{ flex: 1 }} />
      <Button title={t("consent.accept")} onPress={accept} disabled={!terms || !privacy} loading={busy} />
      <Button title={t("settings.signOut")} kind="plain" size="medium" onPress={() => supabase.auth.signOut()} style={{ marginTop: 6 }} />
    </View>
  );
}
