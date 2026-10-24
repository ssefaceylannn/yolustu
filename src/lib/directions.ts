import { ActionSheetIOS, Alert, Linking, Platform } from "react-native";
import type { TFn } from "@/i18n";

type Target = { lat: number; lng: number; label: string };

const apps = (p: Target) => [
  { name: "Google Haritalar", url: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving` },
  { name: "Yandex Navigasyon", url: `yandexnavi://build_route_on_map?lat_to=${p.lat}&lon_to=${p.lng}` },
  ...(Platform.OS === "ios" ? [{ name: "Apple Haritalar", url: `maps://?daddr=${p.lat},${p.lng}&dirflg=d` }] : []),
];

export function openDirections(t: TFn, target: Target) {
  const list = apps(target);
  const open = async (url: string) => {
    const ok = await Linking.canOpenURL(url).catch(() => false);
    Linking.openURL(ok ? url : list[0].url).catch(() => {});
  };
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: t("place.openIn"), options: [...list.map((a) => a.name), t("common.cancel")], cancelButtonIndex: list.length },
      (i) => { if (i < list.length) open(list[i].url); },
    );
  } else {
    Alert.alert(t("place.openIn"), undefined, [...list.map((a) => ({ text: a.name, onPress: () => open(a.url) })), { text: t("common.cancel"), style: "cancel" as const }]);
  }
}

export function openRouteInGoogle(points: { lat: number; lng: number }[]) {
  if (points.length < 2) return;
  const origin = points[0], dest = points[points.length - 1];
  const way = points.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join("|");
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}${way ? `&waypoints=${encodeURIComponent(way)}` : ""}&travelmode=driving`;
  Linking.openURL(url).catch(() => {});
}
