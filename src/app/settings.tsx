import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, Linking, Modal, View } from "react-native";
import { Button, Field, Row, Screen, Section, Segmented, Txt } from "@/components/ui";
import { useI18n, type Locale } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { CONTACT_EMAIL } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { useTheme, type ThemePreference } from "@/theme/ThemeProvider";

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { colors, preference, setPreference } = useTheme();
  const { settings, updateSettings, userId, profile } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const changeLocale = (l: Locale) => { setLocale(l); updateSettings({ locale: l }).catch(() => {}); };

  const toggleVisible = async (v: boolean) => {
    await updateSettings(v ? { visible_nearby: true, nearby_consent_at: new Date().toISOString() } : { visible_nearby: false });
    if (!v) await supabase.rpc("clear_presence");
  };

  const exportData = async () => {
    const { data, error } = await supabase.rpc("export_my_data");
    if (error) return Alert.alert(t("common.error"));
    try {
      const file = new File(Paths.cache, `yolustu-verilerim-${new Date().toISOString().slice(0, 10)}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(data, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
    } catch { Alert.alert(t("common.error")); }
  };

  const deleteAccount = async () => {
    if (confirmText.trim().toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US") !== t("settings.deleteWord")) return;
    setBusy(true);
    try {
      // Önce dosyalar (depolama), sonra hesap ve tüm satırlar
      const { data: photos } = await supabase.from("place_photos").select("path").eq("user_id", userId!);
      const paths = (photos ?? []).map((p) => p.path);
      if (paths.length) await supabase.storage.from("place-photos").remove(paths);
      if (profile?.avatar_path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await supabase.auth.signOut();
    } catch {
      setBusy(false);
      Alert.alert(t("common.error"));
    }
  };

  return (
    <Screen>
      <Section title={t("settings.language")}>
        <View style={{ padding: 12 }}>
          <Segmented<Locale> value={locale} onChange={changeLocale} options={[{ value: "tr", label: "Türkçe" }, { value: "en", label: "English" }]} />
        </View>
      </Section>
      <Section title={t("settings.appearance")}>
        <View style={{ padding: 12 }}>
          <Segmented<ThemePreference> value={preference} onChange={setPreference}
            options={[{ value: "system", label: t("settings.system") }, { value: "light", label: t("settings.light") }, { value: "dark", label: t("settings.dark") }]} />
        </View>
      </Section>
      <Section title={t("settings.privacy")} footer={t("travelers.invisibleBody")}>
        <Row icon="travelers" iconColor="#2E7D57" title={t("settings.visibleNearby")} switchValue={!!settings?.visible_nearby} onSwitch={toggleVisible} />
        <Row icon="block" iconColor="#C9403A" title={t("settings.blocked")} chevron last onPress={() => router.push("/blocked")} />
      </Section>
      <Section title={t("settings.legal")}>
        <Row icon="doc" iconColor="#6F7C85" title={t("settings.kvkk")} chevron onPress={() => router.push("/legal/kvkk")} />
        <Row icon="lock" iconColor="#6F7C85" title={t("settings.privacyPolicy")} chevron onPress={() => router.push("/legal/privacy")} />
        <Row icon="doc" iconColor="#6F7C85" title={t("settings.terms")} chevron onPress={() => router.push("/legal/terms")} />
        <Row icon="info" iconColor="#6F7C85" title={t("settings.licenses")} chevron last onPress={() => router.push("/legal/licenses")} />
      </Section>
      <Section title={t("settings.account")}>
        {CONTACT_EMAIL ? <Row icon="mail" iconColor="#2B7BB9" title={t("settings.contact")} chevron onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} /> : null}
        <Row icon="download" iconColor="#2B7BB9" title={t("settings.export")} chevron onPress={exportData} />
        <Row icon="signOut" iconColor="#6F7C85" title={t("settings.signOut")} onPress={() => supabase.auth.signOut()} />
        <Row icon="trash" iconColor="#C9403A" title={t("settings.deleteAccount")} destructive last onPress={() => { setConfirmText(""); setDeleting(true); }} />
      </Section>
      <Txt variant="footnote" color="tertiary" style={{ textAlign: "center", marginTop: 24 }}>{t("settings.version", { v: Constants.expoConfig?.version ?? "1.0.0" })}</Txt>

      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => setDeleting(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 20 }}>
            <Txt variant="title3">{t("settings.deleteAccount")}</Txt>
            <Txt variant="subhead" color="secondary" style={{ marginTop: 8 }}>{t("settings.deleteConfirm")}</Txt>
            <Field label={t("settings.deleteType")} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Button title={t("common.cancel")} kind="gray" style={{ flex: 1 }} onPress={() => setDeleting(false)} />
              <Button title={t("common.delete")} kind="destructive" style={{ flex: 1 }} loading={busy}
                disabled={confirmText.trim().toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US") !== t("settings.deleteWord")} onPress={deleteAccount} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
