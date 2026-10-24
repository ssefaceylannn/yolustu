import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Button, Chip, Field, Row, Screen, Section, Segmented, Txt } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { brandsFor } from "@/lib/brands";
import { supabase } from "@/lib/supabase";
import type { Vehicle } from "@/lib/types";

const KINDS: Vehicle["kind"][] = ["motorhome", "caravan", "van", "car", "suv", "pickup", "motorcycle", "other"];
const FUELS: NonNullable<Vehicle["fuel"]>[] = ["diesel", "petrol", "lpg", "hybrid", "electric"];

export default function VehicleScreen() {
  const { t } = useI18n();
  const { userId } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [kind, setKind] = useState<Vehicle["kind"]>("motorhome");
  const [brand, setBrand] = useState("");
  const [customBrand, setCustomBrand] = useState(false);
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [fuel, setFuel] = useState<Vehicle["fuel"]>("diesel");
  const [gearbox, setGearbox] = useState<NonNullable<Vehicle["gearbox"]>>("manual");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [tows, setTows] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from("vehicles").select("*").eq("user_id", userId).order("is_primary", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      const v = data as Vehicle | null;
      if (!v) return;
      setId(v.id); setKind(v.kind); setBrand(v.brand ?? ""); setModel(v.model ?? ""); setYear(v.year ? String(v.year) : "");
      setFuel(v.fuel); setGearbox(v.gearbox ?? "manual"); setLength(v.length_cm ? String(v.length_cm) : "");
      setHeight(v.height_cm ? String(v.height_cm) : ""); setWeight(v.weight_kg ? String(v.weight_kg) : ""); setTows(v.tows_caravan);
      setCustomBrand(!!v.brand && !brandsFor(v.kind).includes(v.brand));
    });
  }, [userId]);

  const num = (s: string) => (s.trim() ? Number(s.replace(/\D/g, "")) || null : null);
  const save = async () => {
    setBusy(true);
    const row = { kind, brand: brand.trim() || null, model: model.trim() || null, year: num(year), fuel, gearbox,
      length_cm: num(length), height_cm: num(height), weight_kg: num(weight), tows_caravan: tows, is_primary: true };
    const { error } = id ? await supabase.from("vehicles").update(row).eq("id", id) : await supabase.from("vehicles").insert(row);
    setBusy(false);
    if (error) return Alert.alert(t("common.error"), error.message.includes("check") ? `${t("vehicle.dimensions")}?` : undefined);
    router.back();
  };

  const brands = brandsFor(kind);
  return (
    <Screen>
      <Txt variant="footnote" color="secondary" style={{ marginTop: 12 }}>{t("vehicle.why")}</Txt>
      <Txt variant="footnoteMedium" color="secondary" style={{ marginTop: 20, marginBottom: 8 }}>{t("vehicle.kind").toLocaleUpperCase("tr")}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {KINDS.map((k) => <Chip key={k} label={t(`kind.${k}` as TKey)} selected={kind === k} onPress={() => setKind(k)} />)}
      </View>

      <Txt variant="footnoteMedium" color="secondary" style={{ marginTop: 20, marginBottom: 8 }}>{t("vehicle.brand").toLocaleUpperCase("tr")}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {brands.map((b) => <Chip key={b} label={b} selected={!customBrand && brand === b} onPress={() => { setBrand(b); setCustomBrand(false); }} />)}
        <Chip label={t("vehicle.otherBrand")} selected={customBrand} onPress={() => { setCustomBrand(true); setBrand(""); }} />
      </View>
      {customBrand ? <Field label={t("vehicle.brand")} value={brand} onChangeText={setBrand} maxLength={40} /> : null}
      <Field label={t("vehicle.model")} value={model} onChangeText={setModel} maxLength={60} />
      <Field label={t("vehicle.year")} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />

      {kind !== "caravan" ? (
        <>
          <Txt variant="footnoteMedium" color="secondary" style={{ marginTop: 20, marginBottom: 8 }}>{t("vehicle.fuel").toLocaleUpperCase("tr")}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FUELS.map((f) => <Chip key={f} label={t(`fuel.${f}` as TKey)} selected={fuel === f} onPress={() => setFuel(f)} />)}
          </View>
          <Txt variant="footnoteMedium" color="secondary" style={{ marginTop: 20, marginBottom: 8 }}>{t("vehicle.gearbox").toLocaleUpperCase("tr")}</Txt>
          <Segmented value={gearbox} onChange={setGearbox} options={[{ value: "manual", label: t("gear.manual") }, { value: "automatic", label: t("gear.automatic") }]} />
        </>
      ) : null}

      <Txt variant="footnoteMedium" color="secondary" style={{ marginTop: 20 }}>{t("vehicle.dimensions").toLocaleUpperCase("tr")}</Txt>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Field label={t("vehicle.length")} value={length} onChangeText={setLength} keyboardType="number-pad" maxLength={4} /></View>
        <View style={{ flex: 1 }}><Field label={t("vehicle.height")} value={height} onChangeText={setHeight} keyboardType="number-pad" maxLength={3} /></View>
      </View>
      <Field label={t("vehicle.weight")} value={weight} onChangeText={setWeight} keyboardType="number-pad" maxLength={5} />
      {kind !== "caravan" && kind !== "motorcycle" ? (
        <Section><Row title={t("vehicle.tows")} switchValue={tows} onSwitch={setTows} last /></Section>
      ) : null}
      <Button title={t("common.save")} onPress={save} loading={busy} style={{ marginTop: 24 }} />
    </Screen>
  );
}
