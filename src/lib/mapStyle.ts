import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { MAP_STYLE_LIGHT } from "./config";

// Harita stili hafifletilir: 3B binalar ve hazır POI simgeleri (bizim yerlerimizle çakışan)
// çıkarılır. Zayıf cihazlarda kaydırma/yakınlaştırma belirgin şekilde akıcılaşır.
// Stil cihazda saklanır; açılışta beklemeden kullanılır, arkada güncellenir.

const KEY = "yolustu.mapStyle.v1";
const WAIT_MS = 2500;
type Style = { version: number; sources: Record<string, unknown>; layers: { id: string; type: string }[]; [k: string]: unknown };

let memo: Style | null = null;
let pending: Promise<Style | null> | null = null;

function lighten(s: Style): Style {
  const layers = s.layers.filter((l) => l.type !== "fill-extrusion" && !/^poi/i.test(l.id) && !/^(aeroway|airport)/i.test(l.id));
  return { ...s, layers };
}

const valid = (s: any): s is Style => !!s && s.version === 8 && Array.isArray(s.layers) && s.layers.length > 10 && typeof s.sources === "object";

async function fetchRemote(): Promise<Style | null> {
  try {
    const ctrl = new AbortController();
    const h = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(MAP_STYLE_LIGHT, { signal: ctrl.signal });
    clearTimeout(h);
    if (!res.ok) return null;
    const json = await res.json();
    if (!valid(json)) return null;
    const light = lighten(json);
    AsyncStorage.setItem(KEY, JSON.stringify(light)).catch(() => {});
    return light;
  } catch {
    return null;
  }
}

function load(): Promise<Style | null> {
  if (memo) return Promise.resolve(memo);
  if (!pending) {
    pending = (async () => {
      try {
        const cached = await AsyncStorage.getItem(KEY);
        if (cached) {
          const s = JSON.parse(cached);
          if (valid(s)) { memo = s; fetchRemote().then((f) => { if (f) memo = f; }); return memo; }
        }
      } catch { /* yok say */ }
      memo = await fetchRemote();
      if (!memo) pending = null; // sonraki açılışta tekrar dene
      return memo;
    })();
  }
  return pending;
}

// Uygulama açılır açılmaz yüklemeye başla
export function preloadMapStyle() { load().catch(() => {}); }

// Hazırsa hafif stil nesnesi, olmazsa (çevrimdışı ilk açılış vb.) adres döner; hazırlanırken null
export function useMapStyle(): Style | string | null {
  const [style, setStyle] = useState<Style | string | null>(memo);
  useEffect(() => {
    if (memo) return;
    let alive = true;
    const timer = setTimeout(() => { if (alive) setStyle((s) => s ?? MAP_STYLE_LIGHT); }, WAIT_MS);
    load().then((s) => { if (alive) setStyle((cur) => (cur === null ? s ?? MAP_STYLE_LIGHT : cur)); });
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  return style;
}
