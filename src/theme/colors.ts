export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  separator: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  danger: string;
  success: string;
  warning: string;
  overlay: string;
  mapVisited: string;
  mapUnvisited: string;
};

export const light: Palette = {
  background: "#F6F3EC",
  surface: "#FFFFFF",
  surfaceAlt: "#EFEBE1",
  elevated: "#FFFFFF",
  text: "#18201B",
  textSecondary: "#5E6661",
  textTertiary: "#949A95",
  separator: "rgba(60,60,67,0.16)",
  primary: "#1F4D3A",
  primaryText: "#FFFFFF",
  primarySoft: "#DDE8E1",
  accent: "#E8853A",
  accentSoft: "#FBE7D6",
  danger: "#C9403A",
  success: "#2E8B57",
  warning: "#C98A1A",
  overlay: "rgba(0,0,0,0.35)",
  mapVisited: "#E8853A",
  mapUnvisited: "#E4DFD3",
};

export const dark: Palette = {
  background: "#0E1210",
  surface: "#181E1A",
  surfaceAlt: "#222A25",
  elevated: "#1F2722",
  text: "#F1EFE9",
  textSecondary: "#A3ABA6",
  textTertiary: "#6C746F",
  separator: "rgba(235,235,245,0.16)",
  primary: "#7CC39C",
  primaryText: "#0E1210",
  primarySoft: "#1F3329",
  accent: "#F2A15E",
  accentSoft: "#3A2A1C",
  danger: "#E5645D",
  success: "#5CC08A",
  warning: "#E0AE4C",
  overlay: "rgba(0,0,0,0.55)",
  mapVisited: "#F2A15E",
  mapUnvisited: "#2A322D",
};

// Yer kategorileri harita renkleri
export const categoryColors: Record<string, string> = {
  campsite: "#2E7D57",
  caravan_site: "#1F4D3A",
  wild_camp: "#5B8C3A",
  picnic: "#7A9A3A",
  water: "#2B7BB9",
  toilet: "#6F7C85",
  shower: "#3F8FA8",
  dump_station: "#8A6A3D",
  fuel: "#B5562F",
  lpg: "#C2702A",
  ev_charging: "#2F9E8F",
  repair: "#5B5F97",
  tyres: "#4B4E6D",
  car_dealer: "#6B5B95",
  viewpoint: "#D07A2B",
  beach: "#D9A441",
  lake: "#3C8DBC",
  waterfall: "#2F7FA3",
  peak: "#7B6A58",
  spring: "#3AA0A0",
  cave: "#6A5D52",
  attraction: "#C0563B",
  historic: "#9C6B3F",
};
