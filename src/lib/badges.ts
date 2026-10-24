import type { IconName } from "@/components/Icon";

export type BadgeDef = { id: string; icon: IconName; family: "start" | "checkins" | "provinces" | "pioneer" | "nights" | "km" | "nature" | "region" | "community" };

const ids = (prefix: string, values: (string | number)[]) => values.map((v) => `${prefix}_${v}`);

export const BADGES: BadgeDef[] = [
  { id: "first_step", icon: "checkin", family: "start" },
  ...ids("checkins", [10, 50, 100, 250]).map((id) => ({ id, icon: "checkin" as IconName, family: "checkins" as const })),
  ...ids("provinces", [5, 10, 25, 50, 81]).map((id) => ({ id, icon: "map" as IconName, family: "provinces" as const })),
  ...ids("region", ["marmara", "ege", "akdeniz", "ic_anadolu", "karadeniz", "dogu_anadolu", "guneydogu"]).map((id) => ({ id, icon: "badge" as IconName, family: "region" as const })),
  ...ids("pioneer", [1, 10]).map((id) => ({ id, icon: "pin" as IconName, family: "pioneer" as const })),
  ...ids("nights", [1, 10, 30, 100]).map((id) => ({ id, icon: "campsite" as IconName, family: "nights" as const })),
  ...ids("km", [1000, 5000, 10000, 25000]).map((id) => ({ id, icon: "route" as IconName, family: "km" as const })),
  { id: "nature_beach", icon: "beach", family: "nature" },
  { id: "nature_lake", icon: "lake", family: "nature" },
  { id: "nature_peak", icon: "peak", family: "nature" },
  { id: "nature_waterfall", icon: "waterfall", family: "nature" },
  { id: "nature_cave", icon: "cave", family: "nature" },
  { id: "reviewer_10", icon: "pencil", family: "community" },
  { id: "mapper_5", icon: "plus", family: "community" },
  { id: "photographer_20", icon: "camera", family: "community" },
];

export const FAMILY_COLORS: Record<BadgeDef["family"], string> = {
  start: "#2E8B57", checkins: "#1F4D3A", provinces: "#E8853A", region: "#B5562F", pioneer: "#6B5B95",
  nights: "#2E7D57", km: "#2B7BB9", nature: "#3AA0A0", community: "#C0563B",
};
