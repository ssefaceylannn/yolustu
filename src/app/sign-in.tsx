import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { OtpVerify } from "@/components/OtpVerify";
import { ResendEmail } from "@/components/ResendEmail";
import { Button, Field, Screen, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { authErrorText, isEmail } from "@/lib/authErrors";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const submit = async () => {
    setError(null);
    setUnconfirmed(false);
    if (!isEmail(email)) return setError(t("auth.err.email"));
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) {
      setError(authErrorText(t, e));
      const m = (e.code || e.message || "").toLowerCase();
      setUnconfirmed(m.includes("not_confirmed") || m.includes("not confirmed"));
    }
  };

  const forgot = () => router.push({ pathname: "/forgot", params: isEmail(email) ? { email: email.trim() } : {} });

  return (
    <Screen>
      <Field testID="email" label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field testID="password" label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 12, marginLeft: 4 }}>{error}</Txt> : null}
      {unconfirmed ? <View style={{ marginTop: 4 }}><OtpVerify email={email.trim()} /><View style={{ marginTop: 10 }}><ResendEmail email={email.trim()} /></View></View> : null}
      <Button testID="signin-submit" title={t("welcome.signIn")} onPress={submit} loading={busy} style={{ marginTop: 24 }} />
      <Button title={t("auth.forgot")} kind="plain" size="medium" onPress={forgot} style={{ marginTop: 8 }} />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 28 }}>
        <Txt variant="subhead" color="secondary">{t("auth.noAccount")}</Txt>
        <Button title={t("welcome.signUp")} kind="tinted" size="small" onPress={() => router.replace("/sign-up")} />
      </View>
    </Screen>
  );
}
