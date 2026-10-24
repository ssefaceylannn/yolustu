import { useState } from "react";
import { Alert } from "react-native";
import { Button, Field, Screen, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { authErrorText, isEmail } from "@/lib/authErrors";
import { AUTH_RESET_URL, supabase } from "@/lib/supabase";

export default function SignIn() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!isEmail(email)) return setError(t("auth.err.email"));
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) setError(authErrorText(t, e));
  };

  const forgot = async () => {
    if (!isEmail(email)) return setError(t("auth.err.email"));
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: AUTH_RESET_URL });
    if (e) setError(authErrorText(t, e));
    else Alert.alert(t("auth.forgot"), t("auth.resetSent"));
  };

  return (
    <Screen>
      <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 12, marginLeft: 4 }}>{error}</Txt> : null}
      <Button title={t("welcome.signIn")} onPress={submit} loading={busy} style={{ marginTop: 24 }} />
      <Button title={t("auth.forgot")} kind="plain" size="medium" onPress={forgot} style={{ marginTop: 8 }} />
    </Screen>
  );
}
