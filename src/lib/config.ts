// Herkese açık yapılandırma. Gizli anahtarlar burada DEĞİL, sunucuda durur.
export const SUPABASE_URL = "https://jhnazkhvdtwqersdvrco.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DYyLfiyBMJsK_k2BJ-RQ5A_8kEhBoiL";

// Harita karoları (OpenStreetMap verisi, OpenFreeMap sunucusu)
export const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
// OpenFreeMap'in koyu stili henüz tamamlanmadığı için koyu temada da Liberty kullanılır
export const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/liberty";

// MET Norway kimlik bilgisi zorunlu tutuyor
export const WEATHER_USER_AGENT = "Yolustu/1.0 github.com/ssefaceylannn/yolustu";

export const CHECKIN_RADIUS_M = 150;
export const TURKEY_BOUNDS: [number, number, number, number] = [25.6, 35.8, 44.9, 42.2];
export const TURKEY_CENTER: [number, number] = [35.2, 39.0];

// Yasal metinlerde görünen veri sorumlusu ve iletişim adresi (yayın öncesi doldurulacak)
export const DATA_CONTROLLER = "";
export const CONTACT_EMAIL = "";
