import * as Haptics from "expo-haptics";
import { type ComponentRef, type ReactNode, type Ref } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space, type, type TypeVariant } from "@/theme/typography";
import { Icon, type IconName } from "./Icon";

// --- Metin -----------------------------------------------------------------

type TxtProps = TextProps & { variant?: TypeVariant; color?: "primary" | "secondary" | "tertiary" | "accent" | "danger" | "brand" | "onBrand" | string };

export function Txt({ variant = "body", color, style, ...rest }: TxtProps) {
  const { colors } = useTheme();
  const c =
    color === "secondary" ? colors.textSecondary
    : color === "tertiary" ? colors.textTertiary
    : color === "accent" ? colors.accent
    : color === "danger" ? colors.danger
    : color === "brand" ? colors.primary
    : color === "onBrand" ? colors.primaryText
    : color === "primary" || !color ? colors.text
    : color;
  return <RNText {...rest} style={[type[variant], { color: c }, style]} />;
}

// --- Düğme -----------------------------------------------------------------

type ButtonProps = {
  title: string;
  onPress?: () => void;
  kind?: "filled" | "tinted" | "plain" | "destructive" | "gray";
  size?: "large" | "medium" | "small";
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
};

export function Button({ title, onPress, kind = "filled", size = "large", icon, loading, disabled, style, full }: ButtonProps) {
  const { colors } = useTheme();
  const bg =
    kind === "filled" ? colors.primary
    : kind === "tinted" ? colors.primarySoft
    : kind === "destructive" ? colors.danger
    : kind === "gray" ? colors.surfaceAlt
    : "transparent";
  const fg =
    kind === "filled" ? colors.primaryText
    : kind === "destructive" ? "#FFFFFF"
    : kind === "gray" ? colors.text
    : colors.primary;
  const h = size === "large" ? 50 : size === "medium" ? 40 : 32;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [
        { height: h, borderRadius: size === "small" ? radius.pill : radius.md, backgroundColor: bg, paddingHorizontal: size === "small" ? 14 : 18,
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        full && { alignSelf: "stretch" },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon name={icon} size={size === "small" ? 15 : 18} color={fg} weight="semibold" />}
          <Txt variant={size === "small" ? "footnoteMedium" : "headline"} style={{ color: fg }} numberOfLines={1}>{title}</Txt>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, size = 40, color, background, label }: { name: IconName; onPress?: () => void; size?: number; color?: string; background?: string; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
        backgroundColor: background ?? colors.elevated, opacity: pressed ? 0.7 : 1, ...shadow(1) })}
    >
      <Icon name={name} size={size * 0.48} color={color ?? colors.text} weight="medium" />
    </Pressable>
  );
}

// --- Ekran ve başlık -------------------------------------------------------

export function Screen({ children, scroll = true, padded = true, style, contentStyle, ...rest }: {
  children: ReactNode; scroll?: boolean; padded?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
} & ScrollViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      contentContainerStyle={[{ paddingBottom: insets.bottom + 32 }, padded && { paddingHorizontal: space.lg }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export function LargeTitle({ title, right, subtitle }: { title: string; right?: ReactNode; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingBottom: 8, flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt variant="largeTitle" accessibilityRole="header">{title}</Txt>
        {subtitle ? <Txt variant="subhead" color="secondary" style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
      </View>
      {right}
    </View>
  );
}

// --- Gruplu liste (iOS Ayarlar tarzı) -------------------------------------

export function Section({ title, footer, children, style }: { title?: string; footer?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginTop: space.xl }, style]}>
      {title ? <Txt variant="footnote" color="secondary" style={{ textTransform: "uppercase", marginBottom: 6, marginLeft: space.lg }}>{title}</Txt> : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" }}>{children}</View>
      {footer ? <Txt variant="footnote" color="secondary" style={{ marginTop: 6, marginHorizontal: space.lg }}>{footer}</Txt> : null}
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  iconColor?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  last?: boolean;
  right?: ReactNode;
  switchValue?: boolean;
  onSwitch?: (v: boolean) => void;
};

export function Row({ title, subtitle, value, icon, iconColor, onPress, chevron, destructive, last, right, switchValue, onSwitch }: RowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, paddingLeft: space.lg }}>
      {icon ? (
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: iconColor ?? colors.primary, alignItems: "center", justifyContent: "center", marginRight: space.md }}>
          <Icon name={icon} size={17} color="#FFFFFF" weight="medium" />
        </View>
      ) : null}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingRight: space.lg,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.separator }}>
        <View style={{ flex: 1 }}>
          <Txt variant="body" color={destructive ? "danger" : undefined}>{title}</Txt>
          {subtitle ? <Txt variant="footnote" color="secondary" style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
        </View>
        {value ? <Txt variant="body" color="secondary" numberOfLines={1} style={{ marginLeft: 8, maxWidth: "55%" }}>{value}</Txt> : null}
        {right}
        {onSwitch ? <Switch value={!!switchValue} onValueChange={onSwitch} trackColor={{ true: colors.primary, false: undefined }} /> : null}
        {chevron ? <Icon name="chevronRight" size={14} color={colors.textTertiary} style={{ marginLeft: 8 }} weight="semibold" /> : null}
      </View>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
      {content}
    </Pressable>
  );
}

// --- Giriş alanı -----------------------------------------------------------

type FieldProps = TextInputProps & { label?: string; hint?: string; error?: string | null; style?: StyleProp<TextStyle>; ref?: Ref<ComponentRef<typeof TextInput>> };

export function Field({ label, hint, error, style, multiline, ref, ...rest }: FieldProps) {
    const { colors } = useTheme();
    return (
      <View style={{ marginTop: space.md }}>
        {label ? <Txt variant="footnoteMedium" color="secondary" style={{ marginBottom: 6, marginLeft: 4 }}>{label}</Txt> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          multiline={multiline}
          {...rest}
          style={[type.body, {
            color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14,
            paddingTop: multiline ? 12 : 0, paddingBottom: multiline ? 12 : 0, minHeight: multiline ? 110 : 48,
            textAlignVertical: multiline ? "top" : "center", borderWidth: 1, borderColor: error ? colors.danger : "transparent",
          }, style]}
        />
        {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 6, marginLeft: 4 }}>{error}</Txt>
          : hint ? <Txt variant="footnote" color="secondary" style={{ marginTop: 6, marginLeft: 4 }}>{hint}</Txt> : null}
      </View>
    );
}

// --- Seçilebilir çip -------------------------------------------------------

export function Chip({ label, selected, onPress, icon, color }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; color?: string }) {
  const { colors } = useTheme();
  const active = color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill,
        backgroundColor: selected ? active : colors.surface, opacity: pressed ? 0.8 : 1,
        borderWidth: StyleSheet.hairlineWidth, borderColor: selected ? active : colors.separator,
      })}
    >
      {icon ? <Icon name={icon} size={15} color={selected ? "#FFFFFF" : active} weight="medium" /> : null}
      <Txt variant="subheadMedium" style={{ color: selected ? "#FFFFFF" : colors.text }}>{label}</Txt>
    </Pressable>
  );
}

// --- Segment (iOS segmented control) ---------------------------------------

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: 9, padding: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(o.value); }}
            style={{ flex: 1, height: 32, borderRadius: 7, alignItems: "center", justifyContent: "center",
              backgroundColor: on ? (isDark ? colors.elevated : colors.surface) : "transparent", ...(on ? shadow(1) : {}) }}>
            <Txt variant={on ? "footnoteMedium" : "footnote"}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Diğer -----------------------------------------------------------------

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colors } = useTheme();
  const base = [{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }]}>{children}</Pressable>;
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <Txt variant="headline" style={{ textAlign: "center" }}>{title}</Txt>
      {body ? <Txt variant="subhead" color="secondary" style={{ textAlign: "center" }}>{body}</Txt> : null}
      {action}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={colors.primary} /></View>;
}

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: onChange ? 10 : 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        const star = <Icon name={filled ? "star" : "starOutline"} size={size} color={filled ? colors.accent : colors.textTertiary} />;
        return onChange ? (
          <Pressable key={i} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${i}`} onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(i); }}>{star}</Pressable>
        ) : <View key={i}>{star}</View>;
      })}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: inset }} />;
}

export function shadow(level: 1 | 2 | 3): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: "#000", shadowOpacity: 0.08 + level * 0.03, shadowRadius: 4 + level * 4, shadowOffset: { width: 0, height: level * 2 } },
    android: { elevation: level * 3 },
    default: {},
  })!;
}
