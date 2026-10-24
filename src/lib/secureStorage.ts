import * as SecureStore from "expo-secure-store";

// Oturum bilgisi cihazın güvenli deposunda (iOS Keychain / Android Keystore) tutulur.
// Android'de tek kayıt ~2 KB ile sınırlı olduğu için parçalara bölünür.
// Güvenli depo kullanılamazsa (ör. imzasız test derlemesi) oturum diske yazılmaz,
// sadece uygulama açıkken bellekte tutulur.
const CHUNK = 1800;
const countKey = (k: string) => `${k}__n`;
const partKey = (k: string, i: number) => `${k}__${i}`;
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");
// Telefon kilitliyken arka planda oturum yenilenebilsin (yine de cihaz dışına çıkmaz)
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const memory = new Map<string, string>();
let unavailable = false;

async function get(k: string) {
  if (unavailable) return memory.get(k) ?? null;
  try { return await SecureStore.getItemAsync(k, OPTS); } catch { unavailable = true; return memory.get(k) ?? null; }
}
async function set(k: string, v: string) {
  memory.set(k, v);
  if (unavailable) return;
  try { await SecureStore.setItemAsync(k, v, OPTS); } catch { unavailable = true; }
}
async function del(k: string) {
  memory.delete(k);
  if (unavailable) return;
  try { await SecureStore.deleteItemAsync(k, OPTS); } catch { unavailable = true; }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safe(key);
    const n = Number(await get(countKey(k)));
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = await get(partKey(k, i));
      if (p == null) return null;
      parts.push(p);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safe(key);
    const old = Number(await get(countKey(k))) || 0;
    const n = Math.ceil(value.length / CHUNK) || 1;
    for (let i = 0; i < n; i++) await set(partKey(k, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    for (let i = n; i < old; i++) await del(partKey(k, i));
    await set(countKey(k), String(n));
  },
  async removeItem(key: string): Promise<void> {
    const k = safe(key);
    const n = Number(await get(countKey(k))) || 0;
    for (let i = 0; i < n; i++) await del(partKey(k, i));
    await del(countKey(k));
  },
};
