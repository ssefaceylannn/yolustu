import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Button, Field, Screen, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { authErrorText } from "@/lib/authErrors";
import { supabase } from "@/lib/supabase";

// Şifre sıfırlama bağlantısı: yeni şifre belirlenir
export default function ResetPassword() {
  const { t } = useI18n();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(String(code));
        if (e) setError(authErrorText(t, e));
      }
      setReady(true);
    })();
  }, [code, t]);

  const save = async () => {
    if (password.length < 8) return setError(t("auth.err.weak"));
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(authErrorText(t, e));
    Alert.alert(t("common.done"));
    router.replace("/");
  };

  return (
    <Screen>
      <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t("auth.passwordHint")} editable={ready} />
      {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 12, marginLeft: 4 }}>{error}</Txt> : null}
      <Button title={t("common.save")} onPress={save} loading={busy || !ready} style={{ marginTop: 24 }} />
    </Screen>
  );
}
