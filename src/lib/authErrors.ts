import type { TFn } from "@/i18n";

export function authErrorText(t: TFn, e: { message?: string; code?: string; status?: number } | null | undefined) {
  const m = (e?.code || e?.message || "").toLowerCase();
  if (m.includes("invalid_credentials") || m.includes("invalid login")) return t("auth.err.invalid");
  if (m.includes("user_already_exists") || m.includes("already registered")) return t("auth.err.exists");
  if (m.includes("weak_password") || m.includes("password should")) return t("auth.err.weak");
  if (m.includes("email_not_confirmed") || m.includes("not confirmed")) return t("auth.err.notConfirmed");
  if (m.includes("otp_expired") || m.includes("token has expired") || m.includes("invalid otp") || m.includes("otp")) return t("auth.err.code");
  if (m.includes("over_") || m.includes("rate") || e?.status === 429) return t("auth.err.rate");
  if (m.includes("email_address_invalid") || m.includes("invalid email")) return t("auth.err.email");
  if (m.includes("network") || m.includes("fetch")) return t("common.offline");
  return t("common.error");
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const isUsername = (s: string) => /^[a-z0-9_.]{3,24}$/.test(s);
