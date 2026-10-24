// Yasal metinler. Yayın öncesi bir hukukçuya kontrol ettirilmelidir.
// Veri sorumlusu bilgileri config'ten gelir.
import { CONTACT_EMAIL, DATA_CONTROLLER } from "./config";

export type LegalDoc = "kvkk" | "privacy" | "terms" | "licenses";
type Doc = { title: string; updated: string; sections: { h: string; p: string }[] };

const UPDATED = "25.10.2026";
const who = DATA_CONTROLLER || "Yolüstü uygulamasının geliştiricisi";
const mail = CONTACT_EMAIL || "uygulama içindeki Ayarlar > İletişim bölümü";

const tr: Record<LegalDoc, Doc> = {
  kvkk: {
    title: "KVKK Aydınlatma Metni",
    updated: UPDATED,
    sections: [
      { h: "Veri sorumlusu", p: `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla ${who} tarafından aşağıda açıklanan kapsamda işlenir.` },
      { h: "İşlenen kişisel veriler", p: "• Kimlik ve iletişim: e-posta adresi, kullanıcı adı, isteğe bağlı görünen ad, profil fotoğrafı ve hakkında yazısı.\n• Konum: check-in sırasında yere uzaklığınızı doğrulamak için anlık konum (saklanmaz); \"görünür ol\" açıkken yaklaşık 2 km'ye yuvarlanmış konum (6 saat sonra silinir); karşılıklı konum paylaşımında o anki konum (24 saat sonra silinir).\n• Kullanım verileri: check-in yaptığınız yerler ve tarihleri, rozetler, yorumlar, fotoğraflar, eklediğiniz yerler, mesajlar, şikâyet ve engellemeler.\n• Araç bilgileri: tür, marka, model, yıl, yakıt, vites ve ölçüler (sadece size görünür).\n• İşlem güvenliği: oturum bilgileri ve kötüye kullanımı önlemeye yönelik kullanım sayaçları." },
      { h: "İşleme amaçları ve hukuki sebepler", p: "• Hesabınızın oluşturulması ve uygulamanın sunulması (KVKK md. 5/2-c, sözleşmenin ifası).\n• Check-in, rozet, rota ve servis önerisi gibi özelliklerin çalışması (md. 5/2-c).\n• Yakındaki yolcular özelliği: sadece siz açarsanız, açık rızanıza dayanarak (md. 5/1). Rızanızı istediğiniz an \"Gizlen\" diyerek geri alabilirsiniz.\n• Bilgi güvenliği, kötüye kullanımın önlenmesi ve hukuki yükümlülükler (md. 5/2-ç ve 5/2-f, meşru menfaat)." },
      { h: "Aktarım", p: "Verileriniz, uygulamanın altyapı hizmetini sağlayan Supabase Inc.'in Avrupa Birliği'ndeki (Frankfurt, Almanya) sunucularında saklanır. Bu aktarım KVKK md. 9 kapsamında, Kişisel Verileri Koruma Kurulu'nun belirlediği standart sözleşme ile gerçekleştirilir. Rota hesaplamak ve adres aramak için sadece başlangıç, varış ve ara noktaların koordinatları ile arama metni Geoapify'a (Almanya) gönderilir; kimliğiniz gönderilmez. Hava durumu için sadece yerin koordinatı MET Norway'e gönderilir. Verileriniz reklam amacıyla kullanılmaz, satılmaz ve üçüncü kişilerle paylaşılmaz; kanunen zorunlu hâllerde yetkili kamu kurumlarına aktarılabilir." },
      { h: "Saklama süresi", p: "Hesabınız açık olduğu sürece verileriniz saklanır. Hesabınızı uygulama içinden sildiğinizde kişisel verileriniz kalıcı olarak silinir; eklediğiniz yerler kimliğinizden ayrılarak anonim olarak kalır. Yaklaşık konum 6 saatte, konum paylaşımları 24 saatte, kullanım sayaçları 7 günde silinir." },
      { h: "Haklarınız", p: "KVKK md. 11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacını öğrenme, aktarıldığı kişileri bilme, düzeltilmesini, silinmesini veya yok edilmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Verilerinizin bir kopyasını Ayarlar > Verilerimi indir ile alabilir, hesabınızı Ayarlar > Hesabımı sil ile silebilirsiniz. Diğer talepleriniz için: ${mail}." },
    ],
  },
  privacy: {
    title: "Gizlilik Politikası",
    updated: UPDATED,
    sections: [
      { h: "Kısaca", p: "Yolüstü reklam göstermez, izleme (tracking) yazılımı kullanmaz ve verilerinizi satmaz. Sadece uygulamanın çalışması için gereken veriyi toplarız." },
      { h: "Konum", p: "Konumunuz cihazınızda kullanılır: haritada nerede olduğunuzu göstermek, yakındaki yerleri bulmak ve check-in sırasında yere 150 m'den yakın olduğunuzu doğrulamak için. Check-in yaptığınızda konumunuz değil, sadece gittiğiniz yer kaydedilir. Arka planda konum toplanmaz." },
      { h: "Yakındaki yolcular", p: "Bu özellik varsayılan olarak kapalıdır. Açtığınızda konumunuz yaklaşık 2 km'ye yuvarlanarak 6 saatliğine saklanır. Diğer kullanıcılar sizin adınızı, konumunuzu ya da mesafenizi göremez; sadece yakında kaç yolcu olduğunu görür. Size gelen toplu mesajlara cevap verip vermemek size kalmıştır. Konum paylaşımı sadece iki taraf da aynı sohbette paylaşmayı seçerse gerçekleşir ve canlı takip yapılmaz." },
      { h: "Profil ve içerik", p: "Kullanıcı adınız, görünen adınız ve profil fotoğrafınız diğer kullanıcılara görünür. Profilinizi gizli yaparsanız check-in'leriniz, rozetleriniz ve gezi haritanız başkalarına gösterilmez. Yorumlarınız ve fotoğraflarınız ilgili yerin sayfasında görünür. Araç bilgileriniz ve kontrol listeniz sadece size görünür." },
      { h: "Güvenlik", p: "Tüm bağlantılar şifrelidir (HTTPS). Oturum anahtarınız cihazınızın güvenli deposunda (iOS Anahtar Zinciri, Android Keystore) tutulur. Veritabanında her kayıt satır düzeyinde erişim kurallarıyla korunur; bir kullanıcı başkasının özel verisine erişemez." },
      { h: "Çocuklar", p: "Yolüstü 16 yaşından küçükler için tasarlanmamıştır." },
      { h: "İletişim", p: `Sorularınız için: ${mail}.` },
    ],
  },
  terms: {
    title: "Kullanım Koşulları",
    updated: UPDATED,
    sections: [
      { h: "Hizmet", p: "Yolüstü, gezginlerin yer bulmasına, rota planlamasına ve birbirleriyle iletişim kurmasına yardımcı olan ücretsiz bir uygulamadır. Uygulamayı kullanarak bu koşulları kabul etmiş olursunuz." },
      { h: "Bilgilerin doğruluğu", p: "Haritadaki bilgiler OpenStreetMap topluluğundan ve kullanıcılardan gelir; eksik, eski ya da hatalı olabilir. Bir yere gitmeden, konaklamadan ya da yola çıkmadan önce yerel kuralları, izinleri, yol ve hava koşullarını kendiniz kontrol etmelisiniz. Seyahat sırasında trafik kurallarına uymak ve güvenliğiniz sizin sorumluluğunuzdadır; araç kullanırken uygulamayı kullanmayın." },
      { h: "Kullanıcı içerikleri", p: "Eklediğiniz yer, yorum, fotoğraf ve mesajlardan siz sorumlusunuz. Yasa dışı, hakaret, taciz, nefret söylemi, kişisel veri ifşası, spam ya da reklam içeren içerikler yasaktır. Yüklediğiniz içerikleri uygulamada göstermemiz için bize dünya çapında, ücretsiz ve münhasır olmayan bir kullanım izni verirsiniz. Başkasına ait fotoğrafları izinsiz yüklemeyin." },
      { h: "Mesajlaşma", p: "Toplu mesaj özelliğini sadece yolculukla ilgili iletişim için kullanın. Rahatsız olduğunuz kişiyi engelleyebilir ve şikâyet edebilirsiniz. Kötüye kullanım hâlinde hesaplar uyarısız kapatılabilir." },
      { h: "Moderasyon", p: "Şikâyet edilen içerikleri inceleyip kaldırma ve kuralları ihlal eden hesapları askıya alma hakkımız saklıdır. Birden fazla kullanıcı tarafından şikâyet edilen içerikler inceleme tamamlanana kadar otomatik olarak gizlenir." },
      { h: "Sorumluluğun sınırı", p: "Uygulama \"olduğu gibi\" sunulur. Yasaların izin verdiği ölçüde, uygulamadaki bilgilere dayanılarak yapılan işlemlerden doğan zararlardan sorumlu değiliz." },
      { h: "Değişiklikler", p: "Bu koşulları güncelleyebiliriz. Önemli değişikliklerde uygulama içinde bilgilendirme yapılır." },
    ],
  },
  licenses: {
    title: "Veri kaynakları ve lisanslar",
    updated: UPDATED,
    sections: [
      { h: "Harita verisi", p: "Harita ve yer verileri © OpenStreetMap katkıcıları. Open Database License (ODbL) ile lisanslanmıştır: openstreetmap.org/copyright" },
      { h: "Harita karoları", p: "OpenFreeMap (openfreemap.org) — OpenMapTiles şeması." },
      { h: "Hava durumu", p: "Veri: MET Norway (Norveç Meteoroloji Enstitüsü), CC BY 4.0." },
      { h: "Rota ve adres arama", p: "Powered by Geoapify (geoapify.com). Veri © OpenStreetMap katkıcıları." },
      { h: "Yazı tipi", p: "Inter, SIL Open Font License 1.1." },
    ],
  },
};

const en: Record<LegalDoc, Doc> = {
  kvkk: {
    title: "Privacy Notice (KVKK)",
    updated: UPDATED,
    sections: [
      { h: "Data controller", p: `Under the Turkish Personal Data Protection Law No. 6698 ("KVKK"), your personal data is processed by ${DATA_CONTROLLER || "the developer of Yolüstü"} as data controller, as described below.` },
      { h: "Data we process", p: "• Identity and contact: email, username, optional display name, profile photo and bio.\n• Location: your current location to verify distance during a check-in (not stored); while \"visible\" is on, a location rounded to about 2 km (deleted after 6 hours); your current location when you mutually share it in a chat (deleted after 24 hours).\n• Usage data: places you check in and when, badges, reviews, photos, places you add, messages, reports and blocks.\n• Vehicle details: type, brand, model, year, fuel, transmission and dimensions (visible only to you).\n• Security: session data and usage counters that prevent abuse." },
      { h: "Purposes and legal grounds", p: "• Creating your account and providing the app (KVKK art. 5/2-c, performance of contract).\n• Features such as check-ins, badges, routes and service suggestions (art. 5/2-c).\n• Travelers nearby: only if you turn it on, based on your explicit consent (art. 5/1). You can withdraw it at any time by tapping \"Hide\".\n• Information security, abuse prevention and legal obligations (art. 5/2-ç and 5/2-f, legitimate interest)." },
      { h: "Transfers", p: "Your data is stored on servers of our infrastructure provider Supabase Inc. in the European Union (Frankfurt, Germany), under the standard contract set by the Turkish Data Protection Board (KVKK art. 9). To calculate routes and search addresses, only the coordinates of start, destination and stops and the search text are sent to Geoapify (Germany), without your identity. For weather, only the place's coordinates are sent to MET Norway. Your data is never used for advertising, never sold and never shared with third parties, except with authorities when legally required." },
      { h: "Retention", p: "Your data is kept while your account is open. When you delete your account in the app, your personal data is permanently deleted; places you added remain anonymously. Approximate locations are deleted after 6 hours, location shares after 24 hours and usage counters after 7 days." },
      { h: "Your rights", p: `Under KVKK art. 11 you have the right to learn whether your data is processed, request information, learn the purpose, know to whom it is transferred, request correction, deletion or destruction, object, and claim compensation. You can download a copy in Settings > Download my data and delete your account in Settings > Delete my account. For other requests: ${CONTACT_EMAIL || "Settings > Contact in the app"}.` },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: UPDATED,
    sections: [
      { h: "In short", p: "Yolüstü shows no ads, uses no tracking software and never sells your data. We only collect what the app needs to work." },
      { h: "Location", p: "Your location is used on your device to show where you are, find places nearby and verify you're within 150 m during a check-in. A check-in stores the place you visited, not your location. No background location is collected." },
      { h: "Travelers nearby", p: "This feature is off by default. When on, your location is rounded to about 2 km and kept for 6 hours. Others cannot see your name, location or distance; they only see how many travelers are nearby. Whether you reply to group messages is up to you. Location sharing happens only if both people choose to share in the same chat, and there is no live tracking." },
      { h: "Profile and content", p: "Your username, display name and profile photo are visible to other users. If you make your profile private, your check-ins, badges and travel map are hidden. Your reviews and photos appear on the place's page. Your vehicle details and checklist are visible only to you." },
      { h: "Security", p: "All connections are encrypted (HTTPS). Your session key is kept in your device's secure storage (iOS Keychain, Android Keystore). Every database record is protected by row-level access rules; no user can access another user's private data." },
      { h: "Children", p: "Yolüstü is not intended for children under 16." },
      { h: "Contact", p: `Questions: ${CONTACT_EMAIL || "Settings > Contact in the app"}.` },
    ],
  },
  terms: {
    title: "Terms of Use",
    updated: UPDATED,
    sections: [
      { h: "The service", p: "Yolüstü is a free app that helps travelers find places, plan routes and connect with each other. By using the app you accept these terms." },
      { h: "Accuracy", p: "Map information comes from the OpenStreetMap community and users; it may be incomplete, outdated or wrong. Before visiting, staying or setting off, check local rules, permits, road and weather conditions yourself. Obeying traffic rules and your safety are your responsibility; do not use the app while driving." },
      { h: "User content", p: "You are responsible for the places, reviews, photos and messages you add. Illegal content, insults, harassment, hate speech, doxxing, spam and advertising are prohibited. You grant us a worldwide, free, non-exclusive license to display your content in the app. Do not upload others' photos without permission." },
      { h: "Messaging", p: "Use group messages only for travel-related communication. You can block and report anyone who bothers you. Accounts may be closed without notice in case of abuse." },
      { h: "Moderation", p: "We may review and remove reported content and suspend accounts that break the rules. Content reported by several users is hidden automatically until reviewed." },
      { h: "Limitation of liability", p: "The app is provided \"as is\". To the extent permitted by law, we are not liable for damages arising from actions taken based on information in the app." },
      { h: "Changes", p: "We may update these terms. You'll be notified in the app about significant changes." },
    ],
  },
  licenses: {
    title: "Data sources and licenses",
    updated: UPDATED,
    sections: [
      { h: "Map data", p: "Map and place data © OpenStreetMap contributors, licensed under the Open Database License (ODbL): openstreetmap.org/copyright" },
      { h: "Map tiles", p: "OpenFreeMap (openfreemap.org) — OpenMapTiles schema." },
      { h: "Weather", p: "Data: MET Norway (Norwegian Meteorological Institute), CC BY 4.0." },
      { h: "Routing and geocoding", p: "Powered by Geoapify (geoapify.com). Data © OpenStreetMap contributors." },
      { h: "Typeface", p: "Inter, SIL Open Font License 1.1." },
    ],
  },
};

export const legal = { tr, en };
