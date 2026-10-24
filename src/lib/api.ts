import { supabase } from "./supabase";
import type { Category, Place, PlacePin } from "./types";

export async function placesInBounds(b: [number, number, number, number], categories: Category[] | null, filters: string[] | null, limit = 400) {
  const { data, error } = await supabase.rpc("places_in_bbox", {
    min_lng: b[0], min_lat: b[1], max_lng: b[2], max_lat: b[3],
    p_categories: categories?.length ? categories : null,
    p_filters: filters?.length ? filters : null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as PlacePin[];
}

export async function getPlace(id: number) {
  const { data, error } = await supabase.rpc("get_place", { p_id: id });
  if (error) throw error;
  return ((data ?? [])[0] ?? null) as Place | null;
}

export async function searchPlaces(q: string, near?: { lat: number; lng: number }) {
  const { data, error } = await supabase.rpc("search_places", { p_q: q, p_lat: near?.lat ?? 39, p_lng: near?.lng ?? 35, p_limit: 20 });
  if (error) throw error;
  return (data ?? []) as (PlacePin & { province: string | null })[];
}

export type ReportTarget = { type: "user" | "place" | "review" | "photo" | "message" | "broadcast"; id: string };
