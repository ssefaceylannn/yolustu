import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { CodeInput, isCode } from "@/components/OtpVerify";
import { Button, Field, Screen, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { authErrorText, isEmail } from "@/lib/authErrors";
import { AUTH_RESET_URL, supabase } from "@/lib/supabase";

// Şifre sıfırlama: e-postaya gelen kod + yeni şifre
export default function Forgot() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(String(params.email ?? ""));
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    if (!isEmail(email)) return setError(t("auth.err.email"));
    setBusy(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: AUTH_RESET_URL });
    setBusy(false);
    if (e) return setError(authErrorText(t, e));
    setSent(true);
  };

  const save = async () => {
    setError(null);
    if (!isCode(code)) return setError(t("auth.err.code"));
    if (password.length < 8) return setError(t("auth.err.weak"));
    setBusy(true);
    const v = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "recovery" });
    if (v.error) { setBusy(false); return setError(authErrorText(t, v.error)); }
    const u = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (u.error) return setError(authErrorText(t, u.error));
    Alert.alert(t("auth.passwordChanged"));
    router.replace("/");
  };

  return (
    <Screen>
      <Txt variant="body" color="secondary">{sent ? t("auth.resetCodeBody", { email: email.trim() }) : t("auth.resetIntro")}</Txt>
      {!sent ? (
        <>
          <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={send} />
          {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 12, marginLeft: 4 }}>{error}</Txt> : null}
          <Button title={t("auth.sendCode")} onPress={send} loading={busy} style={{ marginTop: 24 }} />
        </>
      ) : (
        <>
          <CodeInput value={code} onChange={setCode} />
          <Field label={t("auth.newPassword")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t("auth.passwordHint")} onSubmitEditing={save} />
          {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 12, marginLeft: 4 }}>{error}</Txt> : null}
          <Button title={t("common.save")} onPress={save} loading={busy} style={{ marginTop: 24 }} />
          <View style={{ marginTop: 8 }}>
            <Button title={t("auth.back")} kind="plain" size="medium" icon="back" onPress={() => { setSent(false); setCode(""); setError(null); }} />
          </View>
        </>
      )}
    </Screen>
  );
}
