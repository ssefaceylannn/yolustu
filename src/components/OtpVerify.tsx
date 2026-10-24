import { useState } from "react";
import { TextInput, View } from "react-native";
import { Button, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { authErrorText } from "@/lib/authErrors";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/typography";

export const cleanCode = (s: string) => s.replace(/\D/g, "").slice(0, 10);
export const isCode = (s: string) => /^\d{6,10}$/.test(s);

// E-postadaki kodu girme kutusu
export function CodeInput({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit?: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 16 }}>
      <Txt variant="footnoteMedium" color="secondary" style={{ marginBottom: 6, marginLeft: 4 }}>{t("auth.code")}</Txt>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(cleanCode(v))}
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={10}
        placeholder="••••••"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={t("auth.code")}
        style={[type.title2, { height: 60, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, textAlign: "center", letterSpacing: 8,
          borderWidth: 1.5, borderColor: isCode(value) ? colors.primary : colors.separator }]}
      />
    </View>
  );
}

// Kayıt doğrulama kodu: doğru girilince oturum açılır
export function OtpVerify({ email }: { email: string }) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!isCode(code)) return setError(t("auth.err.code"));
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
    setBusy(false);
    if (e) setError(authErrorText(t, e));
  };

  return (
    <View>
      <CodeInput value={code} onChange={(v) => { setCode(v); setError(null); }} onSubmit={verify} />
      {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 8, marginLeft: 4 }}>{error}</Txt> : null}
      <Button title={t("auth.verify")} onPress={verify} loading={busy} disabled={!isCode(code)} style={{ marginTop: 14 }} full />
    </View>
  );
}
