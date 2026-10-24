import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionSheetIOS, Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { Card, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { fmtDistance } from "@/lib/format";
import { distanceMeters, getCurrentCoords } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, type } from "@/theme/typography";

type Msg = { id: string; sender_id: string; body: string; kind: "text" | "system"; created_at: string; read_at: string | null };
type Share =
  | { status: "none" }
  | { status: "waiting_them" | "waiting_me"; since: string }
  | { status: "complete"; mine: { lat: number; lng: number; at: string }; theirs: { lat: number; lng: number; at: string } };

async function fetchChat(id: string, userId: string) {
  const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
  if (!conv) return null;
  const otherId = conv.user_a === userId ? conv.user_b : conv.user_a;
  const [{ data: prof }, { data: m }, { data: bl }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name").eq("id", otherId).maybeSingle(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }).limit(500),
    supabase.from("blocks").select("blocked_id").eq("blocked_id", otherId),
  ]);
  supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", id).neq("sender_id", userId).is("read_at", null).then(() => {});
  return { other: prof as { id: string; username: string; display_name: string | null } | null, msgs: (m ?? []) as Msg[], blocked: !!bl?.length };
}

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, fmtNumber, locale } = useI18n();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const [other, setOther] = useState<{ id: string; username: string; display_name: string | null } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [share, setShare] = useState<Share>({ status: "none" });
  const [blocked, setBlocked] = useState(false);
  const list = useRef<FlatList<Msg>>(null);

  const loadShare = useCallback(async () => {
    const { data } = await supabase.rpc("get_location_share", { p_conversation: id });
    if (data) setShare(data as Share);
  }, [id]);

  useEffect(() => {
    let alive = true;
    fetchChat(id, userId!).then((r) => {
      if (!alive || !r) return;
      setOther(r.other);
      setMsgs(r.msgs);
      setBlocked(r.blocked);
      loadShare();
    });
    return () => { alive = false; };
  }, [id, userId, loadShare]);

  useEffect(() => {
    const ch = supabase.channel(`chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (p) => {
        const m = p.new as Msg;
        setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
        if (m.kind === "system") loadShare();
        if (m.sender_id !== userId) supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id).then(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, userId, loadShare]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    const { data, error } = await supabase.from("messages").insert({ conversation_id: id, body }).select("*").single();
    if (error) { setText(body); return Alert.alert(t("common.error"), error.code === "42501" ? t("chat.blocked") : undefined); }
    setMsgs((x) => (x.some((y) => y.id === data.id) ? x : [...x, data as Msg]));
  };

  const shareLocation = () => {
    Alert.alert(t("chat.shareLocation"), t("chat.shareLocationConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.share"), onPress: async () => {
        const c = await getCurrentCoords(true);
        if (!c) return Alert.alert(t("map.noLocation"));
        const { data, error } = await supabase.rpc("share_location", { p_conversation: id, p_lat: c.lat, p_lng: c.lng });
        if (error) return Alert.alert(t("common.error"));
        setShare(data as Share);
      } },
    ]);
  };

  const block = () => {
    if (!other) return;
    Alert.alert(t("common.block"), t("chat.blockConfirm", { username: other.username }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.block"), style: "destructive", onPress: async () => {
        await supabase.from("blocks").insert({ blocked_id: other.id });
        setBlocked(true);
        Alert.alert(t("chat.blockedDone"));
      } },
    ]);
  };

  const menu = () => {
    const opts = [t("chat.shareLocation"), t("common.report"), t("common.block"), t("common.cancel")];
    const run = (i: number) => {
      if (i === 0) shareLocation();
      if (i === 1 && other) router.push({ pathname: "/report", params: { type: "user", id: other.id } });
      if (i === 2) block();
    };
    if (Platform.OS === "ios") ActionSheetIOS.showActionSheetWithOptions({ options: opts, cancelButtonIndex: 3, destructiveButtonIndex: 2 }, run);
    else Alert.alert(other ? `@${other.username}` : "", undefined, [
      { text: opts[0], onPress: () => run(0) }, { text: opts[1], onPress: () => run(1) }, { text: opts[2], style: "destructive", onPress: () => run(2) }, { text: opts[3], style: "cancel" },
    ]);
  };

  const shareCard = share.status !== "none" ? (
    <Card style={{ margin: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="shareLocation" size={20} color={colors.primary} />
        <Txt variant="subheadMedium" style={{ flex: 1 }}>{share.status === "complete" ? t("chat.locationComplete") : t("chat.shareLocation")}</Txt>
      </View>
      {share.status === "waiting_them" ? <Txt variant="footnote" color="secondary">{t("chat.locationWaitingThem")}</Txt> : null}
      {share.status === "waiting_me" ? (
        <>
          <Txt variant="footnote" color="secondary">{t("chat.locationWaitingMe")}</Txt>
          <Txt variant="subheadMedium" color="brand" onPress={shareLocation}>{t("chat.shareLocation")}</Txt>
        </>
      ) : null}
      {share.status === "complete" ? (
        <>
          <Txt variant="footnote" color="secondary">~{fmtDistance(t, distanceMeters(share.mine, share.theirs), fmtNumber)}</Txt>
          <Txt variant="subheadMedium" color="brand" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${share.theirs.lat},${share.theirs.lng}`)}>{t("chat.openTheirLocation")}</Txt>
        </>
      ) : null}
    </Card>
  ) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{
        title: other ? (other.display_name || `@${other.username}`) : "",
        headerRight: () => <Pressable hitSlop={10} onPress={menu} accessibilityLabel="menu"><Icon name="more" size={22} color={colors.primary} /></Pressable>,
      }} />
      {shareCard}
      <FlatList
        ref={list}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          if (item.kind === "system") {
            return <Txt variant="caption" color="tertiary" style={{ textAlign: "center", marginVertical: 6 }}>{t("chat.systemLocation")}</Txt>;
          }
          const mine = item.sender_id === userId;
          return (
            <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
              <View style={{ maxWidth: "80%", backgroundColor: mine ? colors.primary : colors.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 }}>
                <Txt variant="body" style={{ color: mine ? colors.primaryText : colors.text }}>{item.body}</Txt>
              </View>
              <Txt variant="caption" color="tertiary" style={{ marginTop: 2, marginHorizontal: 6 }}>
                {new Date(item.created_at).toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
              </Txt>
            </View>
          );
        }}
      />
      {blocked ? (
        <Txt variant="footnote" color="secondary" style={{ textAlign: "center", padding: 16, paddingBottom: insets.bottom + 16 }}>{t("chat.blocked")}</Txt>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, paddingBottom: insets.bottom + 10, borderTopWidth: 0.5, borderTopColor: colors.separator, backgroundColor: colors.background }}>
          <Pressable hitSlop={8} onPress={shareLocation} accessibilityLabel={t("chat.shareLocation")}><Icon name="shareLocation" size={26} color={colors.primary} /></Pressable>
          <TextInput value={text} onChangeText={setText} placeholder={t("chat.placeholder")} placeholderTextColor={colors.textTertiary} multiline maxLength={1000}
            style={[type.body, { flex: 1, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, maxHeight: 120 }]} />
          <Pressable hitSlop={8} onPress={send} disabled={!text.trim()} accessibilityLabel={t("common.send")}>
            <Icon name="send" size={26} color={text.trim() ? colors.primary : colors.textTertiary} />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
