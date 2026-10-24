import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Button, Field, Stars, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";

export default function ReviewSheet() {
  const { placeId, name } = useLocalSearchParams<{ placeId: string; name?: string }>();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { userId } = useAuth();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [existing, setExisting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from("place_reviews").select("id, rating, body").eq("place_id", Number(placeId)).eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data) { setExisting(data.id); setRating(data.rating); setBody(data.body ?? ""); }
    });
  }, [placeId, userId]);

  const save = async () => {
    if (!rating) return;
    setBusy(true);
    const row = { place_id: Number(placeId), rating, body: body.trim() || null };
    const { error } = existing
      ? await supabase.from("place_reviews").update({ rating: row.rating, body: row.body }).eq("id", existing)
      : await supabase.from("place_reviews").insert(row);
    setBusy(false);
    if (error) return Alert.alert(t("place.writeReview"), error.message.includes("row-level") || error.code === "42501" ? t("review.inappropriate") : t("common.error"));
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    await supabase.from("place_reviews").delete().eq("id", existing);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
      <Txt variant="title2">{existing ? t("place.editReview") : t("place.writeReview")}</Txt>
      {name ? <Txt variant="subhead" color="secondary" style={{ marginTop: 4 }}>{name}</Txt> : null}
      <Txt variant="footnoteMedium" color="secondary" style={{ marginTop: 20, marginBottom: 10 }}>{t("review.rating")}</Txt>
      <Stars value={rating} size={34} onChange={setRating} />
      <Field value={body} onChangeText={setBody} placeholder={t("review.placeholder")} multiline maxLength={1000} />
      <Button title={t("common.save")} onPress={save} loading={busy} disabled={!rating} style={{ marginTop: 20 }} />
      {existing ? <Button title={t("common.delete")} kind="plain" onPress={remove} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}
