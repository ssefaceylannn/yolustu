import * as SecureStore from "expo-secure-store";

// Oturum bilgisi cihazın güvenli deposunda (iOS Keychain / Android Keystore) tutulur.
// Android'de tek kayıt ~2 KB ile sınırlı olduğu için parçalara bölünür.
const CHUNK = 1800;
const countKey = (k: string) => `${k}__n`;
const partKey = (k: string, i: number) => `${k}__${i}`;
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safe(key);
    const n = Number(await SecureStore.getItemAsync(countKey(k)));
    if (!n) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = await SecureStore.getItemAsync(partKey(k, i));
      if (p == null) return null;
      parts.push(p);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safe(key);
    const old = Number(await SecureStore.getItemAsync(countKey(k))) || 0;
    const n = Math.ceil(value.length / CHUNK) || 1;
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(partKey(k, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    for (let i = n; i < old; i++) await SecureStore.deleteItemAsync(partKey(k, i));
    await SecureStore.setItemAsync(countKey(k), String(n));
  },
  async removeItem(key: string): Promise<void> {
    const k = safe(key);
    const n = Number(await SecureStore.getItemAsync(countKey(k))) || 0;
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(partKey(k, i));
    await SecureStore.deleteItemAsync(countKey(k));
  },
};
