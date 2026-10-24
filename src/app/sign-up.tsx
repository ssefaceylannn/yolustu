import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Icon } from "@/components/Icon";
import { OtpVerify } from "@/components/OtpVerify";
import { ResendEmail } from "@/components/ResendEmail";
import { Button, Field, Screen, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { authErrorText, isEmail, isUsername } from "@/lib/authErrors";
import { AUTH_CALLBACK_URL, supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";

export default function SignUp() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<{ name: string; taken: boolean } | null>(null);
  const taken = check?.name === username && check.taken;
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!isUsername(username)) return;
    const h = setTimeout(() => {
      supabase.rpc("username_available", { p_username: username }).then(({ data }) => setCheck({ name: username, taken: data === false }));
    }, 400);
    return () => clearTimeout(h);
  }, [username]);

  const submit = async () => {
    setError(null);
    if (!isEmail(email)) return setError(t("auth.err.email"));
    if (!isUsername(username)) return setError(t("auth.err.username"));
    if (taken) return setError(t("auth.err.usernameTaken"));
    if (password.length < 8) return setError(t("auth.err.weak"));
    setBusy(true);
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: AUTH_CALLBACK_URL, data: { username, locale } },
    });
    setBusy(false);
    if (e) return setError(authErrorText(t, e));
    // Kayıtlı e-postada Supabase hata vermez, boş kimlik listesiyle döner
    if (data.user && data.user.identities?.length === 0) return setError(t("auth.err.exists"));
    if (!data.session) setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <Screen>
        <View style={{ alignItems: "center", marginTop: 32, gap: 12 }}>
          <Icon name="mail" size={54} color={colors.primary} />
          <Txt variant="title2">{t("auth.checkEmail")}</Txt>
          <Txt variant="body" color="secondary" style={{ textAlign: "center" }}>{t("auth.checkEmailBody", { email: sentTo })}</Txt>
          <Txt variant="footnote" color="tertiary" style={{ textAlign: "center" }}>{t("auth.checkSpam")}</Txt>
        </View>
        <OtpVerify email={sentTo} />
        <View style={{ marginTop: 24, gap: 10 }}>
          <ResendEmail email={sentTo} startWithCooldown />
          <Button title={t("auth.goSignIn")} kind="plain" onPress={() => router.replace("/sign-in")} full />
          <Button title={t("auth.back")} kind="plain" icon="back" onPress={() => setSentTo(null)} full />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label={t("auth.username")} value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ""))} autoCapitalize="none" autoCorrect={false}
        autoComplete="username-new" textContentType="username" maxLength={24}
        error={taken ? t("auth.err.usernameTaken") : null} hint={t("auth.usernameHint")} />
      <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t("auth.passwordHint")} />
      {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 12, marginLeft: 4 }}>{error}</Txt> : null}
      <Button title={t("welcome.signUp")} onPress={submit} loading={busy} style={{ marginTop: 24 }} />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 28 }}>
        <Txt variant="subhead" color="secondary">{t("auth.haveAccount")}</Txt>
        <Button title={t("welcome.signIn")} kind="tinted" size="small" onPress={() => router.replace("/sign-in")} />
      </View>
    </Screen>
  );
}
