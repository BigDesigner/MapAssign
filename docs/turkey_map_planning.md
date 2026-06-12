# Türkiye Haritası Entegrasyonu — Planlama ve Mimari Tasarım

Bu doküman, mevcut Dünya Haritası Temsilci Atama Sistemine eklenecek olan **Türkiye Haritası (İl bazlı atama) versiyonu** için teknik gereksinimleri, veritabanı şemasındaki değişiklikleri, dil/lokalizasyon stratejisini ve atılacak adımları planlamak amacıyla hazırlanmıştır.

---

## 1. Mimari Tasarım ve Gereksinimler

Mevcut tekil harita yapısı, hem Dünya hem de Türkiye haritalarını destekleyecek şekilde genişletilecektir.

### A. Tekil Admin Paneli ve Kapsam Seçimi
* Admin giriş yaptığında veya ana ekrandayken bir **Kapsam Seçici (Scope Selector)** (örneğin dikey bir toggle veya dropdown) aracılığıyla "Dünya Haritası" veya "Türkiye Haritası" arasında geçiş yapabilecektir.
* Seçilen kapsama göre:
  * Harita SVG'si dinamik olarak yüklenecek (Dünya SVG'si ya da 81 ilden oluşan Türkiye SVG'si).
  * Temsilci listesi ve temsilciye ait atama listeleri o kapsama göre filtrelenerek yüklenecektir.

### B. Kapsam Bazlı Ayrıştırma (Scope Isolation)
* **Temsilciler (Representatives):** Bir temsilci ya sadece Dünya haritası için (`world`) ya da sadece Türkiye haritası için (`turkey`) tanımlanacaktır.
* **Atamalar (Assignments):** Dünya haritasında atamalar ülke bazlı (ISO kodları ile, örn. `IT`), Türkiye haritasında ise il bazlı (plaka kodları veya ISO 3166-2 kodları ile, örn. `TR-34`, `TR-06`) yapılacaktır.

### C. Dil ve Lokalizasyon (I18n)
* **Dünya Haritası:** UI metinleri, butonlar, uyarılar ve ülke tooltip'leri tamamen **İngilizce** olacaktır.
* **Türkiye Haritası:** UI metinleri, butonlar, temsilci ünvanları, il tooltip'leri ve arayüzdeki her şey tamamen **Türkçe** olacaktır.
* İstemci tarafında dile duyarlı metinler için dinamik bir dil dosyası (`i18n.ts`) veya arayüz çeviri nesnesi kullanılacaktır.

---

## 2. Veritabanı Şeması Değişiklikleri

D1 veritabanındaki mevcut şema, kapsamları desteklemek üzere güncellenecektir.

### `representatives` Tablosu
Temsilcilerin hangi harita kapsamında geçerli olduğunu belirtmek için bir `scope` kolonu eklenecektir.
```sql
ALTER TABLE representatives ADD COLUMN scope TEXT CHECK(scope IN ('world', 'turkey')) NOT NULL DEFAULT 'world';
```

### `country_assignments` Tablosu
Mevcut tablo ismi daha genel bir isim olan `assignments` olarak güncellenecek veya yeni bir `scope` alanı ile birincil anahtar genişletilecektir.
```sql
-- Mevcut country_assignments tablosunun güncellenmesi veya yeni şema:
CREATE TABLE IF NOT EXISTS assignments (
  scope TEXT CHECK(scope IN ('world', 'turkey')) NOT NULL,
  code TEXT NOT NULL, -- Ülke kodu (örn. 'IT') veya İl kodu (örn. 'TR-34')
  representative_id INTEGER NOT NULL,
  PRIMARY KEY (scope, code),
  FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE
);
```

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
    // ...diğer İngilizce metinler
  },
  turkey: {
    title: "Temsilci İl Atama Haritası",
    unassigned: "Atanmamış",
    assignBtn: "Ata",
    unassignBtn: "Atamayı Kaldır",
    changePass: "Şifre Değiştir",
    logout: "Çıkış Yap",
    // ...diğer Türkçe metinler
  }
};
```

---

## 4. Uygulama Adımları (Task List)

### Aşama 1: Veritabanı ve API Hazırlığı
- [ ] D1 veritabanı şemasına `scope` kolonlarını eklemek/güncellemek için migrasyon SQL'i hazırlama ve çalıştırma.
- [ ] Backend API'sini (`backend/index.ts`) `scope` parametresini alacak şekilde güncelleme:
  * `POST /api/admin/representatives` (kapsama göre listeleme ve ekleme)
  * `POST /api/admin/assign` ve `/api/admin/unassign` (kapsam bazlı atama)
  * `GET /api/map/state` (kapsam bazlı harita durumunu dönme)

### Aşama 2: Ön Yüz SVG ve Harita Motoru Güncellemesi
- [ ] Türkiye'nin 81 il sınırını içeren temiz ve optimize edilmiş bir SVG harita dosyasını projeye dahil etme (`frontend/turkey.svg`).
- [ ] `frontend/src/countryNames.ts` benzeri, Türkiye illerini ve plaka kodlarını içeren `frontend/src/cityNames.ts` dosyasını oluşturma.
- [ ] `MapEngine` sınıfını, Türkiye haritasının il sınırlarına ve tıklama/hover olaylarına uyumlu hale getirme.

### Aşama 3: Dinamik Kapsam ve Dil Geçişi
- [ ] Arayüze "Dünya / Türkiye" kapsam geçiş düğmesi ekleme.
- [ ] `i18n.ts` modülünü oluşturma ve arayüzdeki statik metinleri (başlıklar, butonlar vb.) seçili kapsama göre dinamik doldurma.
- [ ] Oturum açma ekranına veya oturum doğrulama API'sine temsilcinin hangi harita kapsamında yetkili olduğunu (`scope`) ekleme; böylece temsilci giriş yaptığında otomatik olarak kendi haritasına yönlendirilecek.

### Aşama 4: Test ve Dağıtım
- [ ] Admin panelinde iki harita arasında sorunsuz geçiş yapıldığının ve verilerin birbirine karışmadığının doğrulanması.
- [ ] Temsilci girişlerinde sadece ilgili haritanın ve Türkçe/İngilizce dillerinin doğru yüklendiğinin doğrulanması.
- [ ] Değişikliklerin canlıya (`production`) gönderilmesi.
