import type { TFn, TKey } from "@/i18n";
import type { Category, Place, PlacePin } from "./types";

export function fmtDistance(t: TFn, meters: number, fmt: (n: number, d?: number) => string) {
  if (meters < 1000) return t("common.m", { n: fmt(Math.round(meters / 10) * 10) });
  return t("common.km", { n: fmt(meters / 1000, meters < 10000 ? 1 : 0) });
}

export function fmtDuration(t: TFn, seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 60) return t("common.min", { n: m });
  return t("common.hour", { h: Math.floor(m / 60), m: m % 60 });
}

export const catLabel = (t: TFn, c: Category) => t(`cat.${c}` as TKey);

export function placeName(t: TFn, p: Pick<PlacePin, "name" | "category">) {
  return p.name?.trim() || t("place.unnamed", { category: catLabel(t, p.category).toLocaleLowerCase() });
}

export function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function relTime(iso: string, locale: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "tr" ? "tr" : "en", { numeric: "auto" });
  if (diff < 60) return rtf.format(-Math.round(diff), "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), "day");
  return fmtDate(iso, locale);
}

export type { Place };
