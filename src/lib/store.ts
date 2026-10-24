import { useSyncExternalStore } from "react";
import type { AmenityKey, Category } from "./types";

// Ekranlar arası paylaşılan küçük durum (harita filtreleri, rota durakları)
function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<T> | ((s: T) => T)) => {
      state = typeof patch === "function" ? (patch as (s: T) => T)(state) : { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

export const mapFilters = createStore<{ categories: Category[]; amenities: (AmenityKey | "free")[] }>({ categories: [], amenities: [] });

export type RoutePoint = { label: string; lat: number; lng: number; placeId?: number };
export const routeState = createStore<{ from: RoutePoint | null; to: RoutePoint | null; stops: RoutePoint[] }>({ from: null, to: null, stops: [] });

export function useStore<T>(store: { get: () => T; subscribe: (l: () => void) => () => void }) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

// Rota durakları (harita ve rota ekranı ortak kullanır)
export const MAX_STOPS = 8;
export function addRouteStop(p: RoutePoint) {
  const s = routeState.get();
  if (s.stops.length >= MAX_STOPS || s.stops.some((x) => samePoint(x, p))) return false;
  routeState.set({ stops: [...s.stops, p] });
  return true;
}
export function removeRouteStop(p: RoutePoint) {
  routeState.set((s) => ({ ...s, stops: s.stops.filter((x) => !samePoint(x, p)) }));
}
export function samePoint(a: RoutePoint, b: RoutePoint) {
  return a.placeId != null && b.placeId != null ? a.placeId === b.placeId : Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}
