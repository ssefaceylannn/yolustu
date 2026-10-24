import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

export type Coords = { lat: number; lng: number; accuracy?: number | null };

export async function ensureLocationPermission(): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Location.requestForegroundPermissionsAsync();
  return res.granted;
}

export async function getCurrentCoords(precise = true): Promise<Coords | null> {
  if (!(await ensureLocationPermission())) return null;
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
  } catch {
    const last = await Location.getLastKnownPositionAsync();
    return last ? { lat: last.coords.latitude, lng: last.coords.longitude, accuracy: last.coords.accuracy } : null;
  }
}

// Ekran açıkken son bilinen konumu tutar (izin istemez; izin yoksa null)
export function useLastLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);
  const mounted = useRef(true);
  const refresh = useCallback(async (ask = false) => {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      if (!ask) { setDenied(!perm.canAskAgain); return null; }
      const ok = await ensureLocationPermission();
      if (!ok) { setDenied(true); return null; }
    }
    setDenied(false);
    const c = await getCurrentCoords(false);
    if (mounted.current && c) setCoords(c);
    return c;
  }, []);
  useEffect(() => {
    mounted.current = true;
    Location.getForegroundPermissionsAsync().then(async (perm) => {
      if (!mounted.current) return;
      if (!perm.granted) { setDenied(!perm.canAskAgain); return; }
      const c = await getCurrentCoords(false);
      if (mounted.current && c) setCoords(c);
    }).catch(() => {});
    return () => { mounted.current = false; };
  }, []);
  return { coords, denied, refresh };
}

export function distanceMeters(a: Coords, b: Coords) {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
