import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { SUPABASE_URL } from "./config";
import { supabase } from "./supabase";

export const publicUrl = (bucket: "place-photos" | "avatars", path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

export async function pickImage(source: "camera" | "library"): Promise<string | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false });
    return r.canceled ? null : r.assets[0].uri;
  }
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, exif: false });
  return r.canceled ? null : r.assets[0].uri;
}

// Fotoğraf küçültülür ve konum bilgisi (EXIF) silinerek JPEG olarak yüklenir.
export async function uploadImage(bucket: "place-photos" | "avatars", folder: string, uri: string, maxSide = 1600) {
  const ctx = ImageManipulator.manipulate(uri).resize({ width: maxSide });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const bytes = await new File(out.uri).arrayBuffer();
  const path = `${folder}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return { path, width: out.width, height: out.height };
}
