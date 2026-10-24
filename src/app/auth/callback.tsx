import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Loading, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";

// E-posta doğrulama bağlantısı: kodu oturuma çevirir
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  useEffect(() => {
    (async () => {
      if (code) await supabase.auth.exchangeCodeForSession(String(code)).catch(() => {});
      router.replace("/");
    })();
  }, [code]);
  return <Screen scroll={false}><Loading /></Screen>;
}
