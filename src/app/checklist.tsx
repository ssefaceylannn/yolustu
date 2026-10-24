import { useEffect, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Button, Screen, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/typography";

type Item = { id: string; label: string; sort: number; done: boolean };

async function fetchItems(defaults: string): Promise<Item[]> {
  const { data } = await supabase.from("checklist_items").select("*").order("sort");
  if (data && data.length === 0) {
    // İlk açılışta varsayılan maddeler
    const rows = defaults.split("|").map((label, i) => ({ label, sort: i }));
    const { data: ins } = await supabase.from("checklist_items").insert(rows).select("*");
    return ((ins ?? []) as Item[]).sort((a, b) => a.sort - b.sort);
  }
  return (data ?? []) as Item[];
}

export default function Checklist() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [items, setItems] = useState<Item[] | null>(null);
  const [text, setText] = useState("");

  const defaults = t("checklist.defaults");
  useEffect(() => { fetchItems(defaults).then(setItems); }, [defaults]);

  const toggle = async (it: Item) => {
    setItems((x) => x?.map((i) => (i.id === it.id ? { ...i, done: !i.done } : i)) ?? null);
    await supabase.from("checklist_items").update({ done: !it.done }).eq("id", it.id);
  };
  const add = async () => {
    const label = text.trim();
    if (!label) return;
    setText("");
    const sort = (items?.reduce((m, i) => Math.max(m, i.sort), 0) ?? 0) + 1;
    const { data } = await supabase.from("checklist_items").insert({ label, sort }).select("*").single();
    if (data) setItems((x) => [...(x ?? []), data as Item]);
  };
  const remove = (it: Item) => Alert.alert(it.label, undefined, [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("common.delete"), style: "destructive", onPress: async () => { await supabase.from("checklist_items").delete().eq("id", it.id); setItems((x) => x?.filter((i) => i.id !== it.id) ?? null); } },
  ]);
  const reset = async () => {
    setItems((x) => x?.map((i) => ({ ...i, done: false })) ?? null);
    await supabase.from("checklist_items").update({ done: false }).eq("done", true);
  };

  const done = items?.filter((i) => i.done).length ?? 0;
  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
        <Txt variant="headline" style={{ flex: 1 }}>{t("checklist.done", { done, total: items?.length ?? 0 })}</Txt>
        <Txt variant="subheadMedium" color="brand" onPress={reset}>{t("checklist.reset")}</Txt>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, marginTop: 10, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${items?.length ? (done / items.length) * 100 : 0}%`, backgroundColor: colors.success }} />
      </View>
      <View style={{ marginTop: 16, backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" }}>
        {(items ?? []).map((it, i) => (
          <Pressable key={it.id} onPress={() => toggle(it)} onLongPress={() => remove(it)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: pressed ? colors.surfaceAlt : "transparent",
              borderBottomWidth: i === (items?.length ?? 0) - 1 ? 0 : 0.5, borderBottomColor: colors.separator })}>
            <Icon name={it.done ? "check" : "circle"} size={24} color={it.done ? colors.success : colors.textTertiary} />
            <Txt variant="body" style={{ flex: 1, textDecorationLine: it.done ? "line-through" : "none", color: it.done ? colors.textSecondary : colors.text }}>{it.label}</Txt>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <TextInput value={text} onChangeText={setText} placeholder={t("checklist.add")} placeholderTextColor={colors.textTertiary} maxLength={120} onSubmitEditing={add}
          style={[type.body, { flex: 1, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, height: 48 }]} />
        <Button title={t("common.save")} size="large" onPress={add} disabled={!text.trim()} />
      </View>
    </Screen>
  );
}
