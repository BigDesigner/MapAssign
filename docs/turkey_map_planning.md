# Türkiye Haritası Entegrasyonu — Planlama ve Mimari Tasarım

Bu doküman, mevcut Dünya Haritası Temsilci Atama Sistemine eklenecek olan **Türkiye Haritası (İl bazlı atama) versiyonu** için teknik gereksinimleri, veritabanı şemasındaki değişiklikleri, dil/lokalizasyon stratejisini ve atılacak adımları planlamak amacıyla hazırlanmıştır.

---

## 1. Mimari Tasarım ve Gereksinimler

Mevcut tekil harita yapısı, hem Dünya hem de Türkiye haritalarını destekleyecek şekilde genişletilecektir.

### A. Tekil Admin Paneli ve Kapsam Seçimi
* Admin giriş yaptığında veya ana ekrandayken bir **Kapsam Seçici (Scope Selector)** (örneğin dikey bir toggle veya dropdown) aracılığıyla "Dünya Haritası" veya "Türkiye Haritası" arasında geçiş yapabilecektir.
* Seçilen kapsama göre:
  * Harita SVG'si dinamik olarak yüklenecek (Dünya SVG'si ya da 81 ilden oluşan Türkiye SVG'si).
  * Temsilci listesi, temsilciye ait atama listeleri ve müşteri listeleri o kapsama göre filtrelenerek yüklenecektir.

### B. Kapsam Bazlı Ayrıştırma (Scope Isolation)
* **Temsilciler (Representatives):** Bir temsilci ya sadece Dünya haritası için (`world`) ya da sadece Türkiye haritası için (`turkey`) tanımlanacaktır.
* **Atamalar (Assignments):** Dünya haritasında atamalar ülke bazlı (ISO kodları ile, örn. `DE`), Türkiye haritasında ise il bazlı (plaka kodları veya ISO 3166-2 kodları ile, örn. `TR-34`, `TR-06`) yapılacaktır.
* **Müşteriler (Customers):** Müşteriler de `map_scope` bilgisiyle birbirinden ayrılacak, böylece iki haritanın müşteri tabanları çakışmayacaktır.

### C. Dil ve Yerelleştirme (I18n)
* **Dünya Haritası:** UI metinleri, butonlar, uyarılar ve ülke tooltip'leri tamamen **İngilizce** olacaktır.
* **Türkiye Haritası:** UI metinleri, butonlar, temsilci ünvanları, il tooltip'leri ve arayüzdeki her şey tamamen **Türkçe** olacaktır.
* İstemci tarafında dile duyarlı metinler için dinamik bir dil dosyası (`i18n.ts`) veya arayüz çeviri nesnesi kullanılacaktır.

---

## 2. Veritabanı Şeması Değişiklikleri

D1 veritabanındaki şema, hem Türkiye hem de CRM yapısını destekleyecek şekilde birleştirilmiştir. `schema.sql` dosyasında aşağıdaki tablolar güncellenmiş ve birleştirilmiştir (Ayrıntılar için [Nihai Entegrasyon Planı](file:///c:/Users/bigde/.antigravity/MapAssign/docs/nihai_entegrasyon_plani.md) dokümanına bakınız):

*   `representatives` tablosuna `map_scope` ve `drive_folder_id` eklenmiştir.
*   `assignments` tablosu `map_scope` ve `region_code` composite key yapısına geçirilmiştir.
*   `customers` tablosu `map_scope` ve `region_code` (örn. `TR-34` veya `DE`) alanlarıyla her iki haritayı da destekleyecek şekilde normalize edilmiştir.

---

## 3. Arayüz ve Dil Yönetimi (Localization)

Uygulamanın dilini seçilen kapsama göre dinamik yönetmek için `frontend/src/i18n.ts` adında bir dosya oluşturulacaktır:

```typescript
export const TRANSLATIONS = {
  world: {
    title: "Representative Map Assignment",
    unassigned: "Unassigned",
    assignBtn: "Assign",
    unassignBtn: "Unassign",
    changePass: "Change Password",
    logout: "Logout",
    customers: "Customers",
    quotes: "Quotes",
    searchPlaceholder: "Search by name, country, email...",
    // ...diğer İngilizce metinler
  },
  turkey: {
    title: "Temsilci İl Atama Haritası",
    unassigned: "Atanmamış",
    assignBtn: "Ata",
    unassignBtn: "Atamayı Kaldır",
    changePass: "Şifre Değiştir",
    logout: "Çıkış Yap",
    customers: "Müşteriler",
    quotes: "Teklifler",
    searchPlaceholder: "İsim, il, e-posta ile ara...",
    // ...diğer Türkçe metinler
  }
};
```

---

## 4. Uygulama Adımları (Task List)

### Aşama 1: Veritabanı ve API Hazırlığı
- [ ] D1 veritabanı şemasına `scope` ve `region_code` alanlarının eklenmesi ve veritabanı migrasyonunun uygulanması.
- [ ] Backend API'sinin (`backend/index.ts`) `scope` parametresini alacak şekilde güncellenmesi.
- [ ] Türkiye ve Dünya temsilcilerinin kendi oturum açma (login) akışlarında sadece kendi harita verilerine erişebilmelerinin sağlanması.

### Aşama 2: Ön Yüz SVG ve Harita Motoru Güncellemesi
- [ ] Türkiye'nin 81 il sınırını içeren temiz ve optimize edilmiş bir SVG harita dosyasının eklenmesi (`frontend/public/turkey.svg`).
- [ ] `frontend/src/countryNames.ts` benzeri, Türkiye illerini ve plaka kodlarını içeren `frontend/src/cityNames.ts` dosyasının oluşturulması.
- [ ] `MapEngine` sınıfının Türkiye haritasının il sınırlarına ve tıklama/hover olaylarına uyumlu hale getirilmesi.

### Aşama 3: Dinamik Kapsam ve Dil Geçişi
- [ ] Arayüze "Dünya / Türkiye" kapsam geçiş düğmesi eklenmesi.
- [ ] `i18n.ts` modülünün oluşturulması ve arayüzdeki statik metinlerin seçili kapsama göre dinamik doldurulması.
- [ ] Oturum açma doğrulamasına temsilcinin hangi harita kapsamında yetkili olduğunu (`map_scope`) ekleme; böylece temsilci giriş yaptığında otomatik olarak kendi haritasına ve diline yönlendirilecek.
