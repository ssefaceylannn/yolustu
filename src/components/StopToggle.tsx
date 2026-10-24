import { Pressable } from "react-native";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";

// Rotaya ekle (+) / rotadan çıkar (−) düğmesi
export function StopToggle({ added, onPress, size = 30 }: { added: boolean; onPress: () => void; size?: number }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={added ? t("route.removeFromRoute") : t("route.addToRoute")} onPress={onPress}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1,
        backgroundColor: added ? colors.danger + "1F" : colors.primarySoft })}>
      <Icon name={added ? "minus" : "plus"} size={size * 0.55} color={added ? colors.danger : colors.primary} weight="bold" />
    </Pressable>
  );
}

