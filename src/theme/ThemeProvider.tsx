import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { dark, light, type Palette } from "./colors";

export type ThemePreference = "system" | "light" | "dark";
type Ctx = { colors: Palette; isDark: boolean; preference: ThemePreference; setPreference: (p: ThemePreference) => void };

const ThemeContext = createContext<Ctx>({ colors: light, isDark: false, preference: "system", setPreference: () => {} });
const KEY = "yolustu.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>("system");
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === "light" || v === "dark" || v === "system") setPref(v); }).catch(() => {});
  }, []);
  const isDark = preference === "system" ? system === "dark" : preference === "dark";
  const value = useMemo<Ctx>(() => ({
    colors: isDark ? dark : light,
    isDark,
    preference,
    setPreference: (p) => { setPref(p); AsyncStorage.setItem(KEY, p).catch(() => {}); },
  }), [isDark, preference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
