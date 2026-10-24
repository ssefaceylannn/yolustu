# Yolüstü — Ürün Kararları

Karavan, kamp ve araçla gezenler için harita, rota, rozet ve topluluk uygulaması.
iPhone ve Android'de aynı koddan çalışır. Arayüz Türkçe ve İngilizce.

## Hedef kitle
Karavancılar (motokaravan, çekme karavan), kampçılar ve kendi aracıyla Türkiye'yi gezen herkes.

## Gelir modeli
- Uygulama ücretsiz, reklamsız.
- **Bağış:** Uygulama içi bahşiş (Apple ve Google ödeme sistemi üzerinden). Şirket kurmadan GVK mükerrer 20/B istisnası ile alınabilir; güncel şartlar bir mali müşavirle teyit edilecek.
- **Firma anlaşmaları (sonra):** Kamp alanları, servisler, restoranlar ve ekipmancılarla indirimler ve öne çıkarma. Kullanıcı sayısı yeterli olunca başlar; firmalardan fatura ile tahsil edileceği için şirket gerekecek.

## İlk sürüm özellikleri

### Harita ve yerler
- OpenStreetMap verisiyle dolu harita: kamp alanı, karavan parkı, su, tuvalet, atık boşaltma, LPG, akaryakıt, tabiat yerleri, seyir noktaları.
- Filtreler: elektrik, su, duş, ücretsiz, deniz/göl kenarı.
- Yer sayfası: fotoğraflar, yorumlar, puan, **hava durumu** (MET Norway, ücretsiz; arayüzde "Data from MET Norway" atfı zorunlu).
- Kullanıcıların yeni yer eklemesi ve düzeltme önermesi.

### Rota
- Nereden–nereye rota. Rota üstündeki ve yakınındaki güzel yerleri, her birinin **ne kadar km/dk saptırdığıyla** gösterir.
- "Yol tarifi başlat" deyince Google Haritalar, Yandex Navigasyon ya da Apple Haritalar'a aktarır. Kendi sesli navigasyonumuz yok.

### Araç profili ve servisler
- Kullanıcı aracını seçer: tür (motokaravan, çekme karavan + çeken araç, panelvan, otomobil, motosiklet), marka, model, yıl, yakıt (dizel, benzin, LPG, hibrit, elektrik), vites (manuel, otomatik), boy, yükseklik, ağırlık.
- Yakındaki tamirciler, lastikçiler ve aracın markasının yetkili servisleri listelenir. Elektrikli araç için şarj noktaları gösterilir.
- Araç ölçülerine göre yol uyarıları (alçak köprü, ağırlık sınırı) sonraki sürüme kalır.

### Rozetler
- Konumla check-in: yere **150 m** yaklaşınca.
- Rozetler: iller, bölgeler, "ilk keşfeden", deniz/dağ/göl, toplam km, gece konaklama sayısı.
- Türkiye haritası boyama (gezilen iller renklenir).
- Instagram hikâyesi boyutunda paylaşılabilir rozet ve harita kartları.

### Topluluk
- Profil: araç, gezi istatistikleri, rozetler. Profil herkese açık ya da gizli olabilir.
- Gezi günlüğü: gidilen yerler ve fotoğraflar.
- **Yakınımdaki yolcular:**
  - Sadece "görünür ol" seçeneğini açanlar sayılır.
  - Kimsenin konumu, mesafesi ya da kimliği gösterilmez; yalnızca "yakınında N yolcu var" bilgisi görünür (en fazla 10 kişi).
  - O kişilere toplu mesaj gönderilebilir. İsteyen birebir cevap verir; cevap verene kadar gönderen alıcının kim olduğunu görmez.
  - Engelleme ve şikâyet her mesajda var. Engellenen kişi bir daha mesaj atamaz.
  - Mesaj sınırları: kişi başı günde sınırlı toplu mesaj, yeni hesaplara ek kısıtlama.
- **Konum paylaşımı:** Hiçbir zaman tek taraflı değil. İki taraf da aynı sohbette "konumumu paylaş" dediğinde, iki tarafın **o anki** konumu bir kez paylaşılır. Canlı konum takibi yok.

### Diğer
- Yola çıkış kontrol listesi (gaz, su, elektrik, kilitler, lastikler…), kişiselleştirilebilir.
- Açık ve koyu tema. Türkçe ve İngilizce.
- Hesap silme ve verilerimi indir.

## Sonraya kalanlar
- Çevrimdışı harita (harita kütüphanesi destekliyor, sonra eklenecek).
- Araç ölçüsüne göre yol uyarıları.
- Takip etme, akış, liderlik tablosu, seviyeler.
- Firma indirimleri (QR), firma paneli.

## Güvenlik ve KVKK
- **Veri minimizasyonu:** Sadece gerekli veri. Telefon numarası, TC kimlik no, gerçek ad zorunlu değil.
- **Konum:**
  - Check-in'de kesin koordinat saklanmaz, sadece gidilen yerin kimliği ve tarih saklanır.
  - "Görünür ol" açıkken konum yaklaşık 2 km'lik ızgara hücresine yuvarlanarak saklanır ve 6 saat sonra otomatik silinir.
  - Konum paylaşımı iki taraflı onayla, tek seferlik.
- **Erişim kontrolü:** Veritabanında her tabloda satır düzeyinde güvenlik (RLS). Kullanıcı sadece kendi özel verisini görür; mesajlar sadece taraflarına açıktır.
- **Altyapı:** Supabase (PostgreSQL + PostGIS), sunucular AB (Frankfurt) bölgesinde. Yurt dışına aktarım için KVKK md. 9 kapsamında Kurul'un standart sözleşmesi Supabase ile imzalanıp 5 iş günü içinde Kurum'a bildirilecek (yayın öncesi, hukukçu ile).
- **Metinler:** KVKK aydınlatma metni, gerektiği yerlerde açık rıza (ör. yakınımdaki yolcular için görünür olma), gizlilik politikası, kullanım koşulları. Yayın öncesi bir hukukçuya kontrol ettirilecek.
- **Haklar:** Uygulama içinden hesap silme (tüm verilerle birlikte), verileri dışa aktarma.
- **İçerik güvenliği:** Şikâyet, engelleme, küfür filtresi, istek sınırlama. Apple'ın kullanıcı içeriği kurallarına uygun.
- **Teknik:** Sadece HTTPS. Oturum anahtarları cihazın güvenli deposunda (Keychain/Keystore). Reklam ve izleme SDK'sı yok.

## Teknik kararlar
| Konu | Seçim | Neden |
|---|---|---|
| Uygulama | React Native + Expo (SDK 58), Expo Router | Tek kod, iOS + Android, Mac gerektirmez |
| Yazı tipi | iOS'ta sistem fontu (SF Pro), Android'de Inter | SF Pro'nun lisansı sadece Apple cihazlarında kullanıma izin veriyor; Inter ona en yakın açık lisanslı font |
| Renkler | Orman yeşili `#1F4D3A`, gün batımı turuncusu `#F2994A`, krem `#FAF6EE` + koyu tema | |
| Harita | MapLibre + OpenFreeMap karoları | Anahtar ve ücret yok, ileride çevrimdışı harita desteği |
| Rota ve adres arama | Geoapify | Ücretsiz plan günde 3.000 kredi; ileride araç ölçülü rota (kamyon modu). OpenRouteService'in API adresi kapanış sürecinde olduğu için değiştirildi |
| Yer verisi | OpenStreetMap (Overpass) → kendi veritabanımıza aktarım | Harita ilk günden dolu |
| Hava durumu | MET Norway Locationforecast | Ücretsiz, anahtar gerekmez |
| Sunucu | Supabase (Auth, Postgres + PostGIS, Storage, Edge Functions), AB bölgesi | Konum sorguları, RLS, KVKK |
| Android test | GitHub Actions ile APK | Ücretsiz, hesap gerektirmez |
| iPhone test | TestFlight (Apple geliştirici hesabı ile) | Harita kütüphanesi Expo Go'da çalışmadığı için |
