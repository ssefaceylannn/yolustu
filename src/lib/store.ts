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
