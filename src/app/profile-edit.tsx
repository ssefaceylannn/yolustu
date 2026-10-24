import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Button, Field, Row, Screen, Section, Txt } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { isUsername } from "@/lib/authErrors";
import { pickImage, uploadImage } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/ProfileParts";

export default function ProfileEdit() {
  const { t } = useI18n();
  const { profile, userId, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  const changeAvatar = async () => {
    const uri = await pickImage("library");
    if (!uri || !userId) return;
    try {
      const up = await uploadImage("avatars", userId, uri, 512);
      if (profile.avatar_path) await supabase.storage.from("avatars").remove([profile.avatar_path]);
      await updateProfile({ avatar_path: up.path });
    } catch { Alert.alert(t("common.error")); }
  };

  const save = async () => {
    setError(null);
    if (!isUsername(username)) return setError(t("auth.err.username"));
    setBusy(true);
    const r = await updateProfile({ display_name: displayName.trim() || null, username, bio: bio.trim() || null, is_public: isPublic });
    setBusy(false);
    if (r.error === "taken") return setError(t("auth.err.usernameTaken"));
    if (r.error) return setError(r.error.includes("row-level") ? t("review.inappropriate") : t("common.error"));
    router.back();
  };

  return (
    <Screen>
      <View style={{ alignItems: "center", marginTop: 16, gap: 8 }}>
        <Pressable onPress={changeAvatar}><Avatar path={profile.avatar_path} name={displayName || username} size={96} /></Pressable>
        <Txt variant="subheadMedium" color="brand" onPress={changeAvatar}>{t("profile.photo")}</Txt>
      </View>
      <Field label={t("profile.displayName")} value={displayName} onChangeText={setDisplayName} maxLength={40} />
      <Field label={t("auth.username")} value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ""))} autoCapitalize="none" autoCorrect={false} maxLength={24} hint={t("auth.usernameHint")} />
      <Field label={t("profile.bio")} value={bio} onChangeText={setBio} multiline maxLength={280} />
      <Section footer={t("profile.publicHint")}>
        <Row title={t("profile.public")} switchValue={isPublic} onSwitch={setIsPublic} last />
      </Section>
      {error ? <Txt variant="footnote" color="danger" style={{ marginTop: 12 }}>{error}</Txt> : null}
      <Button title={t("common.save")} onPress={save} loading={busy} style={{ marginTop: 24 }} />
    </Screen>
  );
}
