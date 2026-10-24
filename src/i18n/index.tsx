import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./en";
import tr, { type TKey } from "./tr";

export type Locale = "tr" | "en";
const dicts: Record<Locale, Record<TKey, string>> = { tr, en };
const KEY = "yolustu.locale";

export type TFn = (key: TKey, vars?: Record<string, string | number>) => string;
type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: TFn; fmtNumber: (n: number, digits?: number) => string };

const deviceLocale = (): Locale => (getLocales()[0]?.languageCode === "tr" ? "tr" : "en");

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === "tr" || v === "en") setLocaleState(v); }).catch(() => {});
  }, []);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);
  const t = useCallback<TFn>((key, vars) => {
    let s: string = dicts[locale][key] ?? tr[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, [locale]);
  const fmtNumber = useCallback((n: number, digits = 0) =>
    n.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t, fmtNumber }), [locale, setLocale, t, fmtNumber]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("I18nProvider missing");
  return c;
}

export type { TKey };
