# Nihai Entegrasyon Planı: Google Drive & Müşteri CRM

Bu doküman; dünya haritası temsilci atama sistemine entegre edilecek olan **Google Drive (Workspace)** ve **Müşteri CRM mimarisi** modüllerinin mantıksal hatalardan arındırılmış nihai planıdır. (Türkiye/İl bazlı kapsam projeden ayrılmıştır).

---

## 1. Tespit Edilen Mantık Hataları ve Çözümleri

Mevcut yol haritaları ve şemalar üzerinde yapılan detaylı incelemede aşağıdaki mantıksal ve mimari tutarsızlıklar tespit edilmiş ve bu nihai planda giderilmiştir:

### A. Şemadaki Temsilci ID Gereksizliği (Redundancy)
*   **Hata:** `customers` tablosunda doğrudan `representative_id` saklanması planlanmıştı. Ülkenin temsilcisi değiştiğinde bu durum senkronizasyon hatalarına ve yabancı anahtar kısıtlaması (Foreign Key Deadlock) oluşmasına yol açar.
*   **Çözüm:** `customers` tablosundan `representative_id` kaldırılmıştır. Bir müşterinin temsilcisi, bulunduğu ülkeye atanan temsilcidir. Sorgulama sırasında `country_assignments` tablosu üzerinden dinamik `JOIN` yapılacaktır.

### B. Yetim Müşteri (Orphan Customer) Riski ve FK Eksikliği
*   **Hata:** Müşteri eklenirken herhangi bir `country_code` yazılabiliyor ve bunun ataması olan bir ülke olup olmadığı DB seviyesinde kontrol edilmiyordu. Bu durumda temsilcisi olmayan bir ülkeye müşteri eklenirse Google Drive klasörü sahipsiz kalabilirdi.
*   **Çözüm:** `customers` tablosuna `FOREIGN KEY (country_code) REFERENCES country_assignments(country_code) ON DELETE RESTRICT` kısıtlaması eklenmiştir. Bu sayede sadece halihazırda temsilci atanmış bir ülkeye müşteri girilebilir. Temsilcisi silinecek ülkenin içindeki müşteriler sistemde askıda kalmaz.

### C. CUST-1001 Formatında Metinsel Birincil Anahtar
*   **Hata:** Müşteri ID'sinin ardışık `CUST-1001` metni olması concurrent (eşzamanlı) işlemlerde çakışmalara yol açar.
*   **Çözüm:** `id` alanı veritabanında `INTEGER PRIMARY KEY AUTOINCREMENT` olarak tutulacak, arayüzde dinamik olarak `CUST-XXXX` formatına dönüştürülecektir.

### D. Google Drive Yetkilendirme Kısıtı (OAuth 2.0 vs. Service Account)
*   **Hata:** Temsilcilerin kişisel OAuth 2.0 token'ları ile işlem yapması planlanmıştı. Bu durumda, ülke ataması değiştiğinde eski temsilci çevrimdışı ise dosyalar Google Drive üzerinde aktarılamaz.
*   **Çözüm:** Google Workspace bünyesinde kurumsal bir **Shared Drive (Ortak Drive)** kullanılacak ve backend işlemleri tam yetkili bir **Google Service Account** ile yapılacaktır. Temsilci yetkileri servis hesabı tarafından klasör paylaşımları ile dağıtılacaktır.

### E. Google Drive Klasör ID Takibi
*   **Hata:** Drive üzerinde sürekli isim bazlı (path) klasör araması yapılması.
*   **Çözüm:** `representatives` ve `country_assignments` tablolarına `drive_folder_id` alanları eklenmiştir. Ülke transferinde klasör ID'si tek bir API çağrısıyla (`parents` güncellenerek) yeni temsilciye taşınır.

### F. Bölgesel Raporlama Verisi Eksikliği
*   **Hata:** SQL ile kıtasal/bölgesel rapor çekilmesi istenmiş ancak ülkelerin bölgelerini belirten bir veri yapısı tasarlanmamıştı.
*   **Çözüm:** Veritabanına ülkelerin ISO kodlarını ve bölgelerini (Europe, Asia vb.) içeren statik bir `countries` tablosu eklenmiştir.

### G. Veri İzolasyonu (Data Isolation)
*   **Hata:** Temsilcilerin tüm müşteri verilerine erişim riski.
*   **Çözüm:** API düzeyinde rol bazlı yetkilendirme uygulanacaktır.

---

## 2. Güncel Veritabanı Şeması (D1 SQLite)

```sql
-- 1. Ülke Master Tablosu (Bölgesel Raporlama İçin)
CREATE TABLE IF NOT EXISTS countries (
    code TEXT PRIMARY KEY, -- 'DE', 'FR' vb.
    name TEXT NOT NULL,
    region TEXT NOT NULL -- 'Europe', 'Asia', 'Americas' vb.
);

-- 2. Temsilciler Tablosu (Genişletilmiş)
CREATE TABLE IF NOT EXISTS representatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    representative_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    drive_folder_id TEXT, -- Temsilcinin Google Drive'daki kök klasör ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Atamalar Tablosu
CREATE TABLE IF NOT EXISTS country_assignments (
    country_code TEXT PRIMARY KEY,
    representative_id INTEGER NOT NULL,
    drive_folder_id TEXT, -- Ülke klasörünün Google Drive ID'si
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE
);

-- 4. Müşteriler Tablosu (Normalleştirilmiş ve Korunan)
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_code TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    social_media TEXT,
    product_groups TEXT,
    drive_folder_id TEXT,
    notes_doc_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (country_code) REFERENCES country_assignments(country_code) ON DELETE RESTRICT
);

-- 5. Teklifler Tablosu
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('USD', 'EUR', 'TRY')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    drive_file_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assignment_rep ON country_assignments(representative_id);
CREATE INDEX IF NOT EXISTS idx_customer_country ON customers(country_code);
CREATE INDEX IF NOT EXISTS idx_quote_customer ON quotes(customer_id);
```

---

## 3. Google Drive Klasör Mimarisi & Servis Hesabı Akışı

### A. Klasör Hiyerarşisi (Shared Drive)
```text
[Ortak Workspace Shared Drive Root]/
└── [Temsilci_Kodu]/ (örn: REP01)
    └── [Ülke_Kodu]/ (örn: DE)
        └── [Müşteri_Kodu]/ (örn: CUST-1001)
            ├── Quotes/ (Teklif PDF'leri)
            ├── Other_Documents/ (Diğer evraklar)
            └── Interview_Notes (Google Doc dosyası)
```

### B. Otomasyon & Taşıma Algoritması
Bir ülkenin temsilcisi `Temsilci_A`'dan `Temsilci_B`'ye geçirildiğinde:
1.  **D1 Güncellemesi:** `country_assignments` tablosunda `representative_id` değeri güncellenir.
2.  **Drive API Tetiklenmesi:** İlgili ülke klasörünün `drive_folder_id` kullanılarak parent ID'si `Temsilci_A`'dan `Temsilci_B`'ye tek bir istekte geçirilir.

---

## 4. Kullanıcı Arayüzü (UI)
*   **Müşteri Tablosu & Arama:** Müşteri adı, ülke kodu, e-posta, telefon alanlarında büyük/küçük harf duyarsız arama. Temsilciler sadece kendi ülkelerindeki müşterileri, Admin tüm tabloyu görür.
*   **Raporlama Paneli:** `countries` tablosundaki `region` kolonundan yararlanılarak Kıta/Bölge bazlı (Örn: Avrupa) tekil SQL (SUM, GROUP BY) raporları oluşturulur.
*   **Renk Paleti İyileştirmesi:** Harita üzerinde göz yormayan, premium koyu tema görünümü sağlamak için modern pastel renk serisi (Yumuşak Mavi `#93c5fd`, Yumuşak Zümrüt `#a7f3d0`, vb.) kullanılır.
