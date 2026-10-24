import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Button, Card, EmptyState, LargeTitle, Segmented, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { relTime } from "@/lib/format";
import { getCurrentCoords, type Coords } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/typography";

type Incoming = { broadcast_id: string; created_at: string; replied: boolean; body: string; sender_id: string; username?: string; display_name?: string | null };
type Conv = { id: string; other: string; last_message_at: string; username?: string; display_name?: string | null; last?: string; unread: number };

const RADIUS_KM = 25;

export default function TravelersScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const { settings, updateSettings, userId } = useAuth();
  const visible = !!settings?.visible_nearby;
  const [coords, setCoords] = useState<Coords | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [tab, setTab] = useState<"inbox" | "chats">("inbox");
  const [inbox, setInbox] = useState<Incoming[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    const { data: rec } = await supabase.from("broadcast_recipients").select("broadcast_id, created_at, replied").eq("recipient_id", userId).eq("dismissed", false).order("created_at", { ascending: false }).limit(50);
    const ids = (rec ?? []).map((r) => r.broadcast_id);
    const { data: bcs } = ids.length ? await supabase.from("broadcasts").select("id, body, sender_id").in("id", ids) : { data: [] as any[] };
    const { data: convRows } = await supabase.from("conversations").select("*").order("last_message_at", { ascending: false }).limit(50);
    const others = (convRows ?? []).map((c: any) => (c.user_a === userId ? c.user_b : c.user_a));
    const senderIds = (bcs ?? []).map((b: any) => b.sender_id);
    const allIds = [...new Set([...others, ...senderIds])];
    const { data: profs } = allIds.length ? await supabase.from("profiles").select("id, username, display_name").in("id", allIds) : { data: [] as any[] };
    const pById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const bById = new Map((bcs ?? []).map((b: any) => [b.id, b]));
    setInbox((rec ?? []).filter((r) => bById.has(r.broadcast_id)).map((r) => {
      const b = bById.get(r.broadcast_id);
      return { ...r, body: b.body, sender_id: b.sender_id, username: pById.get(b.sender_id)?.username, display_name: pById.get(b.sender_id)?.display_name };
    }));
    const convIds = (convRows ?? []).map((c: any) => c.id);
    const { data: lastMsgs } = convIds.length
      ? await supabase.from("messages").select("conversation_id, body, kind, sender_id, read_at, created_at").in("conversation_id", convIds).order("created_at", { ascending: false }).limit(300)
      : { data: [] as any[] };
    setConvs((convRows ?? []).map((c: any) => {
      const other = c.user_a === userId ? c.user_b : c.user_a;
      const msgs = (lastMsgs ?? []).filter((m: any) => m.conversation_id === c.id);
      const last = msgs[0];
      return {
        id: c.id, other, last_message_at: c.last_message_at, username: pById.get(other)?.username, display_name: pById.get(other)?.display_name,
        last: last ? (last.kind === "system" ? t("chat.systemLocation") : last.body) : undefined,
        unread: msgs.filter((m: any) => m.sender_id !== userId && !m.read_at).length,
      };
    }));
  }, [userId, t]);

  const refreshNearby = useCallback(async () => {
    if (!visible) { setCount(null); return; }
    const c = await getCurrentCoords(false);
    if (!c) return;
    setCoords(c);
    await supabase.rpc("update_presence", { p_lat: c.lat, p_lng: c.lng });
    const { data } = await supabase.rpc("nearby_count", { p_lat: c.lat, p_lng: c.lng, p_radius_km: RADIUS_KM });
    setCount(typeof data === "number" ? data : 0);
  }, [visible]);

  useFocusEffect(useCallback(() => { loadMessages(); refreshNearby(); }, [loadMessages, refreshNearby]));

  // Yeni mesaj ve yayınlar anında gelsin
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`travelers-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcast_recipients", filter: `recipient_id=eq.${userId}` }, () => loadMessages())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadMessages]);

  const becomeVisible = async () => {
    const c = await getCurrentCoords(false);
    if (!c) return Alert.alert(t("travelers.title"), t("travelers.locationNeeded"));
    await updateSettings({ visible_nearby: true, nearby_consent_at: new Date().toISOString() });
    setCoords(c);
    await supabase.rpc("update_presence", { p_lat: c.lat, p_lng: c.lng });
    const { data } = await supabase.rpc("nearby_count", { p_lat: c.lat, p_lng: c.lng, p_radius_km: RADIUS_KM });
    setCount(typeof data === "number" ? data : 0);
  };

  const hide = async () => {
    await updateSettings({ visible_nearby: false });
    await supabase.rpc("clear_presence");
    setCount(null);
  };

  const sendReply = async (bid: string) => {
    const body = reply.trim();
    if (!body) return;
    const { data, error } = await supabase.rpc("reply_to_broadcast", { p_broadcast: bid, p_body: body });
    if (error) return Alert.alert(t("common.error"), error.message.includes("inappropriate") ? t("review.inappropriate") : error.message.includes("blocked") ? t("chat.blocked") : undefined);
    setReply(""); setReplyTo(null);
    router.push(`/chat/${data}`);
  };

  const dismiss = async (bid: string) => {
    await supabase.from("broadcast_recipients").update({ dismissed: true }).eq("broadcast_id", bid).eq("recipient_id", userId!);
    setInbox((x) => x.filter((i) => i.broadcast_id !== bid));
  };

  const nearbyText = count == null ? "" : count === 0 ? t("travelers.nearbyNone") : count >= 10 ? t("travelers.nearbyMax") : t("travelers.nearby", { n: count });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([loadMessages(), refreshNearby()]); setRefreshing(false); }} />}>
      <LargeTitle title={t("travelers.title")} />

      {!visible ? (
        <Card style={{ marginTop: 12, gap: 10 }}>
          <Icon name="travelers" size={34} color={colors.primary} />
          <Txt variant="title3">{t("travelers.invisibleTitle")}</Txt>
          <Txt variant="subhead" color="secondary">{t("travelers.invisibleBody")}</Txt>
          <Button title={t("travelers.becomeVisible")} onPress={becomeVisible} style={{ marginTop: 6 }} />
        </Card>
      ) : (
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success }} />
            <Txt variant="subheadMedium" style={{ flex: 1 }}>{t("travelers.visible")}</Txt>
            <Txt variant="subheadMedium" color="brand" onPress={hide}>{t("travelers.hide")}</Txt>
          </View>
          <Txt variant="title2" style={{ marginTop: 14 }}>{nearbyText || " "}</Txt>
          <Txt variant="footnote" color="secondary">{t("travelers.radius", { n: RADIUS_KM })}</Txt>
          <Button title={t("travelers.broadcast")} icon="send" disabled={!count || !coords} style={{ marginTop: 16 }}
            onPress={() => coords && router.push({ pathname: "/broadcast", params: { lat: String(coords.lat), lng: String(coords.lng), radius: String(RADIUS_KM) } })} />
        </Card>
      )}

      <View style={{ marginTop: 24 }}>
        <Segmented value={tab} onChange={setTab} options={[
          { value: "inbox", label: `${t("travelers.inbox")}${inbox.length ? ` (${inbox.length})` : ""}` },
          { value: "chats", label: t("travelers.conversations") },
        ]} />
      </View>

      {tab === "inbox" ? (
        inbox.length === 0 ? <EmptyState icon="mail" title={t("travelers.noMessages")} /> : inbox.map((m) => (
          <Card key={m.broadcast_id} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Txt variant="footnote" color="secondary" style={{ flex: 1 }}>{t("travelers.from", { username: m.username ?? "" })}</Txt>
              <Txt variant="caption" color="tertiary">{relTime(m.created_at, locale)}</Txt>
            </View>
            <Txt variant="body" style={{ marginTop: 8 }}>{m.body}</Txt>
            {replyTo === m.broadcast_id ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                <TextInput autoFocus value={reply} onChangeText={setReply} placeholder={t("chat.placeholder")} placeholderTextColor={colors.textTertiary} maxLength={1000}
                  style={[type.body, { flex: 1, color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 14, height: 40 }]} />
                <Pressable onPress={() => sendReply(m.broadcast_id)} hitSlop={8}><Icon name="send" size={24} color={colors.primary} /></Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 16, marginTop: 12, alignItems: "center" }}>
                {!m.replied ? <Txt variant="subheadMedium" color="brand" onPress={() => { setReplyTo(m.broadcast_id); setReply(""); }}>{t("travelers.reply")}</Txt> : null}
                <Txt variant="subhead" color="secondary" onPress={() => dismiss(m.broadcast_id)}>{t("travelers.dismiss")}</Txt>
                <View style={{ flex: 1 }} />
                <Txt variant="subhead" color="secondary" onPress={() => router.push({ pathname: "/report", params: { type: "broadcast", id: m.broadcast_id } })}>{t("common.report")}</Txt>
                <Txt variant="subhead" color="danger" onPress={() => Alert.alert(t("common.block"), t("chat.blockConfirm", { username: m.username ?? "" }), [
                  { text: t("common.cancel"), style: "cancel" },
                  { text: t("common.block"), style: "destructive", onPress: async () => { await supabase.from("blocks").insert({ blocked_id: m.sender_id }); dismiss(m.broadcast_id); } },
                ])}>{t("common.block")}</Txt>
              </View>
            )}
          </Card>
        ))
      ) : convs.length === 0 ? <EmptyState icon="travelers" title={t("travelers.noMessages")} /> : (
        <View style={{ marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" }}>
          {convs.map((c, i) => (
            <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}`)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                borderBottomWidth: i === convs.length - 1 ? 0 : 0.5, borderBottomColor: colors.separator })}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                <Txt variant="headline" color="brand">{(c.display_name || c.username || "?").slice(0, 1).toLocaleUpperCase("tr")}</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyMedium" numberOfLines={1}>{c.display_name || `@${c.username ?? ""}`}</Txt>
                <Txt variant="footnote" color="secondary" numberOfLines={1}>{c.last ?? ""}</Txt>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Txt variant="caption" color="tertiary">{relTime(c.last_message_at, locale)}</Txt>
                {c.unread ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                  <Txt variant="captionMedium" style={{ color: "#FFF" }}>{c.unread}</Txt>
                </View> : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
