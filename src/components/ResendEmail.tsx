import { useEffect, useState } from "react";
import { Txt, Button } from "@/components/ui";
import { useI18n } from "@/i18n";
import { authErrorText } from "@/lib/authErrors";
import { AUTH_CALLBACK_URL, supabase } from "@/lib/supabase";

const COOLDOWN = 60;

// Doğrulama e-postasını yeniden gönderir (60 sn bekleme ile)
export function ResendEmail({ email, startWithCooldown = false }: { email: string; startWithCooldown?: boolean }) {
  const { t } = useI18n();
  const [left, setLeft] = useState(startWithCooldown ? COOLDOWN : 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (left <= 0) return;
    const h = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(h);
  }, [left]);

  const resend = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: AUTH_CALLBACK_URL } });
    setBusy(false);
    if (error) setMsg({ ok: false, text: authErrorText(t, error) });
    else { setMsg({ ok: true, text: t("auth.resent") }); setLeft(COOLDOWN); }
  };

  return (
    <>
      <Button title={left > 0 ? t("auth.resendIn", { n: left }) : t("auth.resend")} kind="tinted" icon="mail" onPress={resend} loading={busy} disabled={left > 0} full />
      {msg ? <Txt variant="footnote" color={msg.ok ? "brand" : "danger"} style={{ textAlign: "center", marginTop: 8 }}>{msg.text}</Txt> : null}
    </>
  );
}
