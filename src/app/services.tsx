import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Loading, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { openDirections } from "@/lib/directions";
import { catLabel, fmtDistance, placeName } from "@/lib/format";
import { getCurrentCoords } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import type { Category, Vehicle } from "@/lib/types";
import { categoryColors } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

type Service = { id: number; category: Category; name: string | null; lat: number; lng: number; distance_m: number; brand_match: boolean; tags: Record<string, string> };

export default function Services() {
  const { t, fmtNumber } = useI18n();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [items, setItems] = useState<Service[] | null>(null);
  const [noLocation, setNoLocation] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("vehicles").select("*").eq("user_id", userId!).order("is_primary", { ascending: false }).limit(1).maybeSingle();
      const v = data as Vehicle | null;
      setVehicle(v);
      const c = await getCurrentCoords(false);
      if (!c) { setNoLocation(true); setItems([]); return; }
      const { data: rows } = await supabase.rpc("services_near", { p_lat: c.lat, p_lng: c.lng, p_brand: v?.brand ?? null, p_fuel: v?.fuel ?? null, p_radius_m: 30000 });
      setItems((rows ?? []) as Service[]);
    })();
  }, [userId]);

  if (items === null) return <View style={{ flex: 1, backgroundColor: colors.background }}><Loading /></View>;
  const vehicleText = vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(" ") : "";

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={items}
      keyExtractor={(s) => String(s.id)}
      ListHeaderComponent={
        vehicle ? (vehicleText ? <Txt variant="subhead" color="secondary" style={{ marginBottom: 12 }}>{t("services.forVehicle", { vehicle: vehicleText })}</Txt> : undefined)
          : <View style={{ marginBottom: 16, gap: 10 }}>
              <Txt variant="subhead" color="secondary">{t("services.addVehicle")}</Txt>
              <Button title={t("profile.noVehicle")} kind="tinted" size="medium" icon="car" onPress={() => router.push("/vehicle")} />
            </View>
      }
      ListEmptyComponent={<EmptyState icon="wrench" title={noLocation ? t("map.noLocation") : t("services.none")} />}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/place/${item.id}`)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1, borderBottomWidth: 0.5, borderBottomColor: colors.separator })}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: categoryColors[item.category], alignItems: "center", justifyContent: "center" }}>
            <Icon name={item.category} size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyMedium" numberOfLines={1}>{placeName(t, item)}</Txt>
            <Txt variant="footnote" color="secondary">{catLabel(t, item.category)} · {fmtDistance(t, item.distance_m, fmtNumber)}</Txt>
            {item.brand_match && vehicle?.brand ? <Txt variant="captionMedium" color="accent">{t("services.brandMatch", { brand: vehicle.brand })}</Txt> : null}
          </View>
          <Pressable hitSlop={10} onPress={() => openDirections(t, { lat: item.lat, lng: item.lng, label: placeName(t, item) })}>
            <Icon name="directions" size={24} color={colors.primary} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}
