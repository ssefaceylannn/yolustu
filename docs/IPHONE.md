# iPhone'a test sürümü yükleme (Mac olmadan)

Ücretsiz Apple kimliğiyle yüklenen uygulama **7 gün** çalışır; süre dolunca aynı adımlarla yeniden yüklenir (veriler korunur).

## Bir kerelik hazırlık (Windows bilgisayar)
1. **iTunes** ve **iCloud**'u Apple'ın sitesinden (Microsoft Store sürümü değil) indirip kur:
   - iTunes: apple.com/itunes → "Windows için iTunes'u indirin" (64 bit)
   - iCloud: support.apple.com → "iCloud for Windows"
2. **Sideloadly**'yi indir ve kur: sideloadly.io

## Yükleme
1. GitHub → depo → **Releases → iPhone test sürümü** → `yolustu.ipa` dosyasını bilgisayara indir.
2. iPhone'u kabloyla bilgisayara bağla; telefonda **"Bu bilgisayara güven"** → Güven.
3. Sideloadly'yi aç:
   - Üstte iPhone'un görünmeli.
   - `yolustu.ipa` dosyasını pencereye sürükle.
   - **Apple ID** kutusuna Apple kimliğini yaz → **Start**.
   - Apple şifresini ve gelen doğrulama kodunu gir (bunlar sadece Apple'a gider).
4. "Done" yazınca telefonda:
   - **Ayarlar → Gizlilik ve Güvenlik → Geliştirici Modu → Aç** (telefon yeniden başlar, açılınca "Aç"ı onayla).
   - **Ayarlar → Genel → VPN ve Aygıt Yönetimi** → Apple kimliğin → **Güven**.
5. Ana ekrandaki **Yolüstü**'ye dokun.

## Sorun olursa
- "Geliştirici Modu" görünmüyorsa: önce Sideloadly ile bir kez yükle, seçenek sonra çıkar.
- "Untrusted developer" uyarısı: 4. adımdaki **Güven** yapılmamıştır.
- 7 gün sonra uygulama açılmazsa: aynı .ipa ile Sideloadly'de tekrar **Start**.
- Ücretsiz Apple kimliğiyle aynı anda en fazla 3 uygulama bu şekilde yüklenebilir.
