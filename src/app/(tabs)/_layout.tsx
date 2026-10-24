import { NativeTabs } from "expo-router/native-tabs";
import { iconPair } from "@/components/Icon";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";

export default function TabsLayout() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const tabs = [
    { name: "index", label: t("tab.map"), icon: iconPair("map") },
    { name: "route", label: t("tab.route"), icon: iconPair("route") },
    { name: "badges", label: t("tab.badges"), icon: iconPair("badge") },
    { name: "travelers", label: t("tab.travelers"), icon: iconPair("travelers") },
    { name: "profile", label: t("tab.profile"), icon: iconPair("profile") },
  ] as const;
  return (
    <NativeTabs tintColor={colors.primary} backgroundColor={colors.surface} iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.primary } }}>
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.icon.sf} md={tab.icon.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
