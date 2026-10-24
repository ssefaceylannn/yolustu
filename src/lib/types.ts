export type Category =
  | "campsite" | "caravan_site" | "wild_camp" | "picnic" | "water" | "toilet" | "shower" | "dump_station"
  | "fuel" | "lpg" | "ev_charging" | "repair" | "tyres" | "car_dealer"
  | "viewpoint" | "beach" | "lake" | "waterfall" | "peak" | "spring" | "cave" | "attraction" | "historic";

export const CATEGORY_GROUPS: { key: "stay" | "supply" | "vehicle" | "nature"; items: Category[] }[] = [
  { key: "stay", items: ["campsite", "caravan_site", "wild_camp", "picnic"] },
  { key: "supply", items: ["water", "toilet", "shower", "dump_station"] },
  { key: "vehicle", items: ["fuel", "lpg", "ev_charging", "repair", "tyres", "car_dealer"] },
  { key: "nature", items: ["viewpoint", "beach", "lake", "waterfall", "peak", "spring", "cave", "attraction", "historic"] },
];
export const ALL_CATEGORIES: Category[] = CATEGORY_GROUPS.flatMap((g) => g.items);
export const USER_ADDABLE: Category[] = ["campsite", "caravan_site", "wild_camp", "picnic", "water", "toilet", "shower", "dump_station", "lpg", "repair", "tyres", "viewpoint", "beach", "lake", "waterfall", "spring", "cave", "attraction", "historic"];
export const AMENITY_KEYS = ["electricity", "water", "shower", "toilet", "wifi", "dogs"] as const;
export type AmenityKey = (typeof AMENITY_KEYS)[number];

export type PlacePin = {
  id: number;
  category: Category;
  name: string | null;
  lat: number;
  lng: number;
  rating_avg: number;
  rating_count: number;
  tags: Record<string, string>;
};

export type Place = PlacePin & {
  description: string | null;
  source: "osm" | "user";
  province_code: number | null;
  checkin_count: number;
  photo_count: number;
  created_by: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  is_public: boolean;
  created_at: string;
};

export type PrivateSettings = {
  id: string;
  locale: "tr" | "en";
  visible_nearby: boolean;
  terms_accepted_at: string | null;
  privacy_ack_at: string | null;
  nearby_consent_at: string | null;
};

export type Vehicle = {
  id: string;
  kind: "motorhome" | "caravan" | "van" | "car" | "suv" | "pickup" | "motorcycle" | "other";
  brand: string | null;
  model: string | null;
  year: number | null;
  fuel: "diesel" | "petrol" | "lpg" | "hybrid" | "electric" | null;
  gearbox: "manual" | "automatic" | null;
  length_cm: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  tows_caravan: boolean;
};

export type Review = { id: string; place_id: number; user_id: string; rating: number; body: string | null; created_at: string; profiles?: { username: string; display_name: string | null; avatar_path: string | null } | null };
export type Photo = { id: string; place_id: number; user_id: string; path: string; created_at: string };
export type Stats = { checkins: number; provinces: number; km: number; badges: number; places_added: number; reviews: number };
