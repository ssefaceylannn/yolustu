import type { IconName } from "@/components/Icon";
import type { TKey } from "@/i18n";
import { WEATHER_USER_AGENT } from "./config";

export type WeatherNow = { temp: number; symbol: string; windKmh: number; precipMm: number };
export type WeatherDay = { date: string; min: number; max: number; symbol: string };
export type Weather = { now: WeatherNow; days: WeatherDay[]; fetchedAt: number };

const cache = new Map<string, Weather>();

// MET Norway Locationforecast 2.0 (ücretsiz, anahtar gerekmez; kimlik başlığı zorunlu)
export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < 30 * 60 * 1000) return hit;
  const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`, {
    headers: { "User-Agent": WEATHER_USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const data = await res.json();
  const series: any[] = data?.properties?.timeseries ?? [];
  if (!series.length) throw new Error("weather empty");
  const first = series[0];
  const now: WeatherNow = {
    temp: Math.round(first.data.instant.details.air_temperature),
    symbol: first.data.next_1_hours?.summary?.symbol_code ?? first.data.next_6_hours?.summary?.symbol_code ?? "cloudy",
    windKmh: Math.round((first.data.instant.details.wind_speed ?? 0) * 3.6),
    precipMm: first.data.next_1_hours?.details?.precipitation_amount ?? 0,
  };
  // Yerel saate göre günlük en düşük/en yüksek ve öğle simgesi
  type Acc = { min: number; max: number; symbol?: string; symbolHourDiff: number };
  const byDay = new Map<string, Acc>();
  for (const s of series) {
    const d = new Date(s.time);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const temp = s.data.instant.details.air_temperature;
    const sym = s.data.next_6_hours?.summary?.symbol_code ?? s.data.next_1_hours?.summary?.symbol_code;
    const e: Acc = byDay.get(dayKey) ?? { min: temp, max: temp, symbolHourDiff: 99 };
    e.min = Math.min(e.min, temp); e.max = Math.max(e.max, temp);
    const diff = Math.abs(d.getHours() - 12);
    if (sym && diff < e.symbolHourDiff) { e.symbol = sym; e.symbolHourDiff = diff; }
    byDay.set(dayKey, e);
  }
  const days = [...byDay.entries()].slice(0, 5).map(([date, e]) => ({ date, min: Math.round(e.min), max: Math.round(e.max), symbol: e.symbol ?? "cloudy" }));
  const w = { now, days, fetchedAt: Date.now() };
  cache.set(key, w);
  return w;
}

export function weatherVisual(symbol: string): { icon: IconName; label: TKey } {
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return { icon: "wxThunder", label: "wx.thunder" };
  if (s.includes("snow")) return { icon: "wxSnow", label: "wx.snow" };
  if (s.includes("sleet")) return { icon: "wxSnow", label: "wx.sleet" };
  if (s.includes("showers")) return { icon: "wxRain", label: "wx.showers" };
  if (s.startsWith("heavyrain")) return { icon: "wxRain", label: "wx.heavyrain" };
  if (s.startsWith("lightrain")) return { icon: "wxRain", label: "wx.lightrain" };
  if (s.includes("rain")) return { icon: "wxRain", label: "wx.rain" };
  if (s === "fog") return { icon: "wxFog", label: "wx.fog" };
  if (s === "clearsky") return { icon: "wxSun", label: "wx.clearsky" };
  if (s === "fair") return { icon: "wxPartly", label: "wx.fair" };
  if (s === "partlycloudy") return { icon: "wxPartly", label: "wx.partlycloudy" };
  return { icon: "wxCloud", label: "wx.cloudy" };
}
