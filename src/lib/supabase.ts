import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import { secureStorage } from "./secureStorage";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

// Uygulama ön plandayken oturum yenilensin
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// E-posta doğrulama ve şifre sıfırlama bağlantıları uygulamayı açar
export const AUTH_CALLBACK_URL = "yolustu://auth/callback";
export const AUTH_RESET_URL = "yolustu://auth/reset";
