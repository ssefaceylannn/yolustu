# Yolüstü — Kurulum

Kod GitHub'da durur. Derleme, veritabanı güncellemesi ve harita verisi aktarımı GitHub Actions'ta çalışır.

## 1. GitHub gizli anahtarları

Depo → **Settings → Secrets and variables → Actions → New repository secret**

| Ad | Nereden alınır |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → sağ üstte hesap → **Account preferences → Access Tokens → Generate new token** |
| `SUPABASE_DB_PASSWORD` | Supabase projesini açarken belirlenen veritabanı şifresi (unutulduysa: Project Settings → Database → Reset database password) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **secret** (ya da eski tip **service_role**) anahtar |
| `GEOAPIFY_API_KEY` | myprojects.geoapify.com → ücretsiz hesap → **Create a project** → API anahtarı |

Bu anahtarlar sadece GitHub'da durur; uygulamanın içine konmaz.

## 2. Supabase ayarı

Supabase → **Authentication → URL Configuration → Redirect URLs** → `yolustu://**` ekle.
(E-posta doğrulama ve şifre sıfırlama bağlantıları uygulamayı açar.)

### E-posta şablonları (kodla doğrulama)
Authentication → Emails → Templates:
- **Confirm signup** — konu `Yolüstü doğrulama kodun`, içerik:
  ```html
  <h2>Yolüstü hesabını onayla</h2>
  <p>Doğrulama kodun:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
  <p>Bu kodu uygulamaya gir. Kod 1 saat geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
  ```
- **Reset password** — konu `Yolüstü şifre sıfırlama kodun`, aynı içerik (başlık `Şifreni sıfırla`).

Uygulama kodu `verifyOtp` ile doğrular (kayıt: `signup`, şifre: `recovery`). Ücretsiz Supabase e-posta servisi saatte birkaç e-postayla sınırlıdır; yayından önce kendi SMTP (ör. Resend, Brevo) bağlanmalı.

## 3. İlk yayın

1. **Actions → Sunucu (Supabase) → Run workflow**: veritabanı şeması, güvenlik kuralları ve rota fonksiyonu yüklenir.
2. **Actions → Harita verisi (OpenStreetMap) → Run workflow → all**: il sınırları ve Türkiye'deki yerler aktarılır (30–60 dk sürebilir). Sonra her ayın 1'inde kendiliğinden güncellenir.

## 4. Android test sürümü

`main` dalına her kod gönderiminde **Android APK** iş akışı çalışır ve **Releases → Test sürümü** altına `yolustu.apk` yüklenir. Tablette bu dosyayı indirip kurun (bilinmeyen kaynaklardan yüklemeye izin vermek gerekir).

## Yayın öncesi yapılacaklar

- `src/lib/config.ts` içinde `DATA_CONTROLLER` (veri sorumlusunun adı) ve `CONTACT_EMAIL` doldurulacak.
- KVKK: Supabase ile standart sözleşme imzalanıp 5 iş günü içinde Kurum'a bildirilecek; yasal metinler hukukçuya kontrol ettirilecek.
- Mağaza hesapları: Apple Developer (yıllık 99 $), Google Play Console (bir kerelik 25 $).
- Bağış: mağaza hesapları açılınca uygulama içi bahşiş ürünleri eklenecek.
