import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

// Her simgenin iOS (SF Symbols) ve Android (Material Symbols) karşılığı
const ICONS = {
  map: ["map.fill", "map"],
  route: ["point.topleft.down.to.point.bottomright.curvepath", "route"],
  badge: ["rosette", "military_tech"],
  travelers: ["person.2.fill", "group"],
  profile: ["person.crop.circle.fill", "account_circle"],
  search: ["magnifyingglass", "search"],
  filter: ["line.3.horizontal.decrease.circle", "filter_list"],
  locate: ["location.fill", "my_location"],
  plus: ["plus", "add"],
  close: ["xmark", "close"],
  chevronRight: ["chevron.right", "chevron_right"],
  back: ["chevron.left", "arrow_back"],
  star: ["star.fill", "star"],
  starOutline: ["star", "star"],
  camera: ["camera", "photo_camera"],
  photo: ["photo", "image"],
  share: ["square.and.arrow.up", "share"],
  directions: ["arrow.triangle.turn.up.right.diamond.fill", "directions"],
  checkin: ["checkmark.seal.fill", "verified"],
  phone: ["phone", "call"],
  globe: ["globe", "language"],
  clock: ["clock", "schedule"],
  flag: ["flag", "flag"],
  block: ["hand.raised", "block"],
  settings: ["gearshape", "settings"],
  car: ["car.side", "directions_car"],
  wrench: ["wrench.and.screwdriver", "build"],
  checklist: ["checklist", "checklist"],
  send: ["paperplane.fill", "send"],
  shareLocation: ["location.circle", "share_location"],
  trash: ["trash", "delete"],
  pencil: ["pencil", "edit"],
  swap: ["arrow.up.arrow.down", "swap_vert"],
  check: ["checkmark.circle.fill", "check_circle"],
  circle: ["circle", "radio_button_unchecked"],
  lock: ["lock", "lock"],
  signOut: ["rectangle.portrait.and.arrow.right", "logout"],
  download: ["arrow.down.circle", "download"],
  removePerson: ["person.crop.circle.badge.xmark", "person_remove"],
  mail: ["envelope", "mail"],
  info: ["info.circle", "info"],
  heart: ["heart", "favorite"],
  pin: ["mappin.and.ellipse", "location_on"],
  sliders: ["slider.horizontal.3", "tune"],
  hidden: ["eye.slash", "visibility_off"],
  moon: ["moon", "dark_mode"],
  sun: ["sun.min", "light_mode"],
  language: ["character.bubble", "translate"],
  doc: ["doc.text", "gavel"],
  more: ["ellipsis", "more_horiz"],
  copy: ["doc.on.doc", "content_copy"],
  antenna: ["antenna.radiowaves.left.and.right", "cell_tower"],
  // Hava durumu
  wxSun: ["sun.max", "sunny"],
  wxPartly: ["cloud.sun", "partly_cloudy_day"],
  wxCloud: ["cloud", "cloud"],
  wxRain: ["cloud.rain", "rainy"],
  wxSnow: ["cloud.snow", "weather_snowy"],
  wxThunder: ["cloud.bolt", "thunderstorm"],
  wxFog: ["cloud.fog", "foggy"],
  wind: ["wind", "air"],
  drop: ["drop", "water_drop"],
  // Kategoriler
  campsite: ["tent", "camping"],
  caravan_site: ["bus", "rv_hookup"],
  wild_camp: ["tent.2", "forest"],
  picnic: ["fork.knife", "park"],
  water: ["drop.fill", "water_drop"],
  toilet: ["toilet", "wc"],
  shower: ["shower.handheld", "shower"],
  dump_station: ["arrow.3.trianglepath", "recycling"],
  fuel: ["fuelpump", "local_gas_station"],
  lpg: ["flame", "propane_tank"],
  ev_charging: ["bolt.car", "ev_station"],
  repair: ["wrench.adjustable", "build"],
  tyres: ["circle.dashed", "tire_repair"],
  car_dealer: ["storefront", "storefront"],
  viewpoint: ["binoculars", "visibility"],
  beach: ["beach.umbrella", "beach_access"],
  lake: ["water.waves", "waves"],
  waterfall: ["drop", "water"],
  peak: ["mountain.2", "terrain"],
  spring: ["leaf", "water_drop"],
  cave: ["mountain.2", "landscape"],
  attraction: ["mappin", "travel_explore"],
  historic: ["building.columns", "castle"],
} as const satisfies Record<string, readonly [SFSymbol, AndroidSymbol]>;

export type IconName = keyof typeof ICONS;
export const iconPair = (name: IconName) => ({ sf: ICONS[name][0], md: ICONS[name][1] });

type Props = { name: IconName; size?: number; color?: ColorValue; style?: StyleProp<ViewStyle>; weight?: "regular" | "medium" | "semibold" | "bold" };

export function Icon({ name, size = 22, color, style, weight = "regular" }: Props) {
  const { colors } = useTheme();
  const [ios, android] = ICONS[name];
  return <SymbolView name={{ ios, android }} size={size} tintColor={color ?? colors.text} style={style} weight={weight} />;
}
