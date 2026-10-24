import { router } from "expo-router";
import { Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";

export default function Welcome() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const points: [IconName, string][] = [
    ["map", t("welcome.point1")],
    ["route", t("welcome.point2")],
    ["badge", t("welcome.point3")],
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16, paddingHorizontal: 28 }}>
      <View style={{ alignItems: "center" }}>
        <Image source={require("../../assets/images/icon.png")} style={{ width: 96, height: 96, borderRadius: 22 }} accessibilityIgnoresInvertColors />
        <Txt variant="largeTitle" style={{ marginTop: 20 }}>Yolüstü</Txt>
        <Txt variant="title3" color="secondary" style={{ marginTop: 6, textAlign: "center" }}>{t("welcome.tagline")}</Txt>
      </View>
      <View style={{ marginTop: 48, gap: 22 }}>
        {points.map(([icon, text]) => (
          <View key={icon} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Icon name={icon} size={30} color={colors.accent} />
            <Txt variant="body" style={{ flex: 1 }}>{text}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Button title={t("welcome.signUp")} onPress={() => router.push("/sign-up")} />
      <Button title={t("welcome.signIn")} kind="plain" onPress={() => router.push("/sign-in")} style={{ marginTop: 8 }} />
    </View>
  );
}
