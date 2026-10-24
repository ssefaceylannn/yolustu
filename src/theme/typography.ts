import { Platform, type TextStyle } from "react-native";

// iOS'ta sistem fontu (SF Pro), Android'de Inter.
const android = Platform.OS === "android";
const family = (w: "400" | "500" | "600" | "700"): TextStyle =>
  android
    ? { fontFamily: { "400": "Inter_400Regular", "500": "Inter_500Medium", "600": "Inter_600SemiBold", "700": "Inter_700Bold" }[w] }
    : { fontWeight: w };

// Apple'ın metin stilleri (Human Interface Guidelines)
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, letterSpacing: 0.37, ...family("700") },
  title1: { fontSize: 28, lineHeight: 34, letterSpacing: 0.36, ...family("700") },
  title2: { fontSize: 22, lineHeight: 28, letterSpacing: 0.35, ...family("700") },
  title3: { fontSize: 20, lineHeight: 25, letterSpacing: 0.38, ...family("600") },
  headline: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41, ...family("600") },
  body: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41, ...family("400") },
  bodyMedium: { fontSize: 17, lineHeight: 22, letterSpacing: -0.41, ...family("500") },
  callout: { fontSize: 16, lineHeight: 21, letterSpacing: -0.32, ...family("400") },
  subhead: { fontSize: 15, lineHeight: 20, letterSpacing: -0.24, ...family("400") },
  subheadMedium: { fontSize: 15, lineHeight: 20, letterSpacing: -0.24, ...family("500") },
  footnote: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, ...family("400") },
  footnoteMedium: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, ...family("600") },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0, ...family("400") },
  captionMedium: { fontSize: 12, lineHeight: 16, letterSpacing: 0, ...family("600") },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
