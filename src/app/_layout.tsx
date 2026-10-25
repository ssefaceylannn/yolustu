import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { router, Stack, useSegments } from "expo-router";
import { preloadMapStyle } from "@/lib/mapStyle";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider, useI18n } from "@/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

SplashScreen.preventAutoHideAsync().catch(() => {});
preloadMapStyle();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <Navigation fontsReady={fontsLoaded || Platform.OS === "ios"} />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigation({ fontsReady }: { fontsReady: boolean }) {
  const { ready, session, settings } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const signedIn = !!session;
  const settingsLoaded = !signedIn || settings !== null;
  const consented = !!settings?.terms_accepted_at && !!settings?.privacy_ack_at;
  const show = ready && fontsReady && settingsLoaded;

  useEffect(() => { if (show) SplashScreen.hideAsync().catch(() => {}); }, [show]);

  // Oturum yokken uygulama karşılama ekranından başlar. (Korumalı rota yönlendirmesi
  // aksi halde alfabetik ilk açık ekranı — ör. "Şifremi unuttum" — seçiyordu.)
  // E-posta bağlantıları (auth/...) ve yasal metinler olduğu gibi açılır.
  const segments = useSegments();
  const top = segments[0] as string | undefined;
  const wasSignedIn = useRef<boolean | null>(null);
  useEffect(() => {
    if (!show) return;
    const prev = wasSignedIn.current;
    wasSignedIn.current = signedIn;
    // Sadece açılışta ve çıkış yapıldığında bir kez
    if (signedIn || prev === false) return;
    if (top === "welcome" || top === "auth" || top === "legal") return;
    setTimeout(() => router.replace("/welcome"), 0);
  }, [show, signedIn, top]);
  if (!show) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const header = {
    headerBackButtonDisplayMode: "minimal" as const,
    headerTintColor: colors.primary,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: Platform.OS === "android"
      ? { fontFamily: "Inter_600SemiBold", fontSize: 18, color: colors.text }
      : { fontWeight: "600" as const, fontSize: 17, color: colors.text },
    headerLargeTitleStyle: { fontWeight: "700" as const, fontSize: 34, color: colors.text },
    contentStyle: { backgroundColor: colors.background },
  };
  const sheet = { presentation: "formSheet" as const, sheetGrabberVisible: true, sheetCornerRadius: 20, headerShown: false };

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={header}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: t("welcome.signIn") }} />
          <Stack.Screen name="sign-up" options={{ title: t("welcome.signUp") }} />
          <Stack.Screen name="forgot" options={{ title: t("auth.forgot") }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !consented}>
          <Stack.Screen name="consent" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && consented}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="place/[id]" options={{ title: "", headerTransparent: true }} />
          <Stack.Screen name="place/new" options={{ title: t("add.title") }} />
          <Stack.Screen name="review" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
          <Stack.Screen name="report" options={{ ...sheet, sheetAllowedDetents: [0.7] }} />
          <Stack.Screen name="filters" options={{ ...sheet, sheetAllowedDetents: [0.6, 0.95] }} />
          <Stack.Screen name="broadcast" options={{ ...sheet, sheetAllowedDetents: [0.6] }} />
          <Stack.Screen name="chat/[id]" options={{ title: "" }} />
          <Stack.Screen name="user/[id]" options={{ title: "" }} />
          <Stack.Screen name="profile-edit" options={{ title: t("profile.edit") }} />
          <Stack.Screen name="vehicle" options={{ title: t("vehicle.title") }} />
          <Stack.Screen name="services" options={{ title: t("services.title") }} />
          <Stack.Screen name="checklist" options={{ title: t("checklist.title") }} />
          <Stack.Screen name="settings" options={{ title: t("settings.title") }} />
          <Stack.Screen name="blocked" options={{ title: t("settings.blocked") }} />
        </Stack.Protected>
        <Stack.Screen name="legal/[doc]" options={{ title: "" }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="auth/reset" options={{ title: t("auth.password") }} />
      </Stack>
    </>
  );
}
