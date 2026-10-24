// Hesabı ve tüm kişisel verileri siler (KVKK: silme hakkı).
// Önce kullanıcının bütün dosyaları (gizlenmiş fotoğraflar dahil) depolamadan silinir, sonra hesap.
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  try {
    const { data: objects, error } = await admin.rpc("user_storage_objects", { p_user: user.id });
    if (error) throw error;
    const byBucket = new Map<string, string[]>();
    for (const o of (objects ?? []) as { bucket_id: string; name: string }[]) {
      byBucket.set(o.bucket_id, [...(byBucket.get(o.bucket_id) ?? []), o.name]);
    }
    for (const [bucket, names] of byBucket) {
      for (let i = 0; i < names.length; i += 100) {
        const { error: rmErr } = await admin.storage.from(bucket).remove(names.slice(i, i + 100));
        if (rmErr) throw rmErr;
      }
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;
    return json({ ok: true });
  } catch {
    return json({ error: "delete_failed" }, 500);
  }
});
