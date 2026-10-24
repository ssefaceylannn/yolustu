import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProvinceShapes } from "@/components/TurkeyMap";
import { supabase } from "./supabase";

const KEY = "yolustu.provinceShapes.v1";
let memo: ProvinceShapes | null = null;

// İl sınırları nadiren değişir: cihazda saklanır
export async function loadProvinceShapes(): Promise<ProvinceShapes | null> {
  if (memo) return memo;
  try {
    const cached = await AsyncStorage.getItem(KEY);
    if (cached) { memo = JSON.parse(cached); return memo; }
  } catch { /* yok say */ }
  const { data, error } = await supabase.rpc("province_shapes");
  if (error || !data?.features?.length) return null;
  memo = data as ProvinceShapes;
  if (memo.features.length >= 81) AsyncStorage.setItem(KEY, JSON.stringify(memo)).catch(() => {});
  return memo;
}

export async function loadVisited(userId?: string) {
  const { data } = await supabase.rpc("visited_provinces", userId ? { p_user: userId } : {});
  return new Set<number>(((data ?? []) as { code: number }[]).map((r) => r.code));
}
