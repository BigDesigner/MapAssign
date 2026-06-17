# Nihai Entegrasyon Planı: Google Drive & Müşteri CRM

Bu doküman; dünya haritası temsilci atama sistemine entegre edilecek olan **Google Drive (Workspace)** ve **Müşteri CRM mimarisi** modüllerinin mantıksal hatalardan arındırılmış nihai planıdır. (Türkiye/İl bazlı kapsam projeden ayrılmıştır).

---

## 1. Tespit Edilen Mantık Hataları ve Çözümleri

Mevcut yol haritaları ve şemalar üzerinde yapılan detaylı incelemede aşağıdaki mantıksal, mimari ve güvenlik tutarsızlıkları tespit edilmiş ve bu nihai planda giderilmiştir:

### A. Şemadaki Temsilci ID Gereksizliği (Redundancy)
*   **Hata:** `customers` tablosunda doğrudan `representative_id` saklanması planlanmıştı. Ülkenin temsilcisi değiştiğinde bu durum senkronizasyon hatalarına ve yabancı anahtar kısıtlaması (Foreign Key Deadlock) oluşmasına yol açar.
*   **Çözüm:** `customers` tablosundan `representative_id` kaldırılmıştır. Bir müşterinin temsilcisi, bulunduğu ülkeye atanan temsilcidir. Sorgulama sırasında `country_assignments` tablosu üzerinden dinamik `JOIN` yapılacaktır.

### B. Müşteri Atama Kilidi ve FK Çıkmazı (Referential Integrity Logic Lock)
*   **Hata:** `customers` tablosunun `FOREIGN KEY (country_code) REFERENCES country_assignments(country_code)` şeklinde bağlanması. Bu durumda bir ülkedeki temsilci atamasını silmek veya değiştirmek istediğimizde, o ülkede müşteri olduğu sürece `ON DELETE RESTRICT` kısıtlaması atamanın silinmesini engeller. Temsilci silindiğinde ise `ON DELETE CASCADE` ülke atamasını silmeye çalışır ancak müşteri kısıtı yüzünden hata verir ve temsilci silinemez. Ayrıca temsilci atanmamış bir ülkeye müşteri eklenemez hale gelir.
*   **Çözüm:** `customers.country_code` kolonu, `country_assignments` yerine doğrudan **`countries(code)`** master tablosuna `FOREIGN KEY` ile bağlanmıştır. Bir ülkenin o an bir temsilci ataması olup olmaması müşterinin veritabanındaki varlığını etkilemez. Müşterinin o anki temsilcisi dinamik olarak `LEFT JOIN` sorgusuyla çekilir; eğer atama yoksa "Temsilci Atanmamış" olarak gösterilir.

### C. CUST-1001 Formatında Metinsel Birincil Anahtar
*   **Hata:** Müşteri ID'sinin ardışık `CUST-1001` metni olması concurrent (eşzamanlı) işlemlerde çakışmalara yol açar.
*   **Çözüm:** `id` alanı veritabanında `INTEGER PRIMARY KEY AUTOINCREMENT` olarak tutulacak, arayüzde dinamik olarak `CUST-XXXX` formatına dönüştürülecektir.

### D. Google Drive Yetkilendirme Kısıtı (OAuth 2.0 vs. Service Account)
*   **Hata:** Temsilcilerin kişisel OAuth 2.0 token'ları ile işlem yapması planlanmıştı. Bu durumda, ülke ataması değiştiğinde eski temsilci çevrimdışı ise dosyalar Google Drive üzerinde aktarılamaz.
*   **Çözüm:** Google Workspace bünyesinde kurumsal bir **Shared Drive (Ortak Drive)** kullanılacak ve backend işlemleri tam yetkili bir **Google Service Account** ile yapılacaktır. Temsilci yetkileri servis hesabı tarafından klasör paylaşımları ile dağıtılacaktır.

### E. Google Drive Klasör ID Takibi ve "Dual-Write" Tutarsızlıkları (Distributed State Desync)
*   **Hata:** Drive üzerinde sürekli isim bazlı (path) klasör araması yapılması. Ayrıca veritabanına müşteri yazıldıktan sonra Drive API çağrısının başarısız olması durumunda kırık linkler oluşması veya tersi durumda Drive'da "Hayalet Klasörlerin" (Orphaned Folders) birikmesi.
*   **Çözüm:** `representatives` ve `country_assignments` tablolarına `drive_folder_id` alanları eklenmiştir. Ülke transferinde klasör ID'si tek bir API çağrısıyla (`parents` güncellenerek) yeni temsilciye taşınır. Ayrıca, `drive_folder_id` ve `notes_doc_id` alanları NULL olabilir olarak tanımlanmış, UI/Backend seviyesinde "Senkronizasyonu Yeniden Dene" mekanizması tasarlanmıştır.

### F. Bölgesel Raporlama Verisi Eksikliği
*   **Hata:** SQL ile kıtasal/bölgesel rapor çekilmesi istenmiş ancak ülkelerin bölgelerini belirten bir veri yapısı tasarlanmamıştı.
*   **Çözüm:** Veritabanına ülkelerin ISO kodlarını ve bölgelerini (Europe, Asia vb.) içeren statik bir `countries` tablosu eklenmiştir.

### G. Temsilci Kodu Değişimi ve Drive Yol Tutarsızlığı (Representative Code Mutability)
*   **Hata:** Drive klasör hiyerarşisinde klasörlerin `[Temsilci_Kodu]` (örn: REP01) adı altında oluşturulması. Admin temsilci kodunu güncellediğinde Drive'daki klasör isminin eski kalması ve dosya yollarının kopması.
*   **Çözüm:** Google Drive root klasör isimleri için değiştirilebilir kullanıcı-temsilci kodları yerine, veritabanındaki değiştirilemeyen **`representatives.id` (örn: `REP_ID_1`)** veya kalıcı bir **UUID** değeri kullanılacaktır.

### H. Çoklu Para Birimli Tekliflerde Raporlama Hatası (Multi-Currency Sum Fallacy)
*   **Hata:** Farklı para birimlerinde (`USD`, `EUR`, `TRY`) teklifler toplanırken döviz kuru dönüştürmesi yapılmadan doğrudan `SUM(amount)` yapılması.
*   **Çözüm:** `quotes` tablosuna, teklif anındaki kurdan hesaplanan normalleştirilmiş bir **`amount_usd`** kolonu eklenmiştir. Raporlamalar tek bir SQL `SUM(amount_usd)` sorgusu ile doğru ve hızlı şekilde yapılabilir.

### I. Ülke Değişimlerinde Eski İzinlerin Kalması (Permission Data Leakage)
*   **Hata:** Ülke temsilcisi değiştiğinde eski temsilcinin Drive klasörü ve Google Doc üzerindeki erişim yetkilerinin kaldırılmaması, eski temsilcinin geçmiş linklerden verilere erişebilmesi.
*   **Çözüm:** Ülke transferi veya temsilci değişikliği yapıldığında, backend servisi Google Drive API üzerinden eski temsilcinin yetkilerini kaldıracak ve yeni temsilciye yetki tanımlayacaktır.

### J. Müşteri/Teklif Silmede Drive Evrak Çöplüğü (Drive Garbage on Physical Delete)
*   **Hata:** Veritabanından fiziksel silme yapıldığında Drive'daki PDF ve dokümanların yetim kalması.
*   **Çözüm:** `customers` ve `quotes` tablolarına **Soft Delete** (`deleted_at`) yapısı getirilmiştir. Fiziksel silme gerektiğinde ise önce Drive API ile dosyaların temizlenmesini sağlayan kontrollü backend servisleri kullanılacaktır.

### K. Atamalar Tablosunda Ülke Kodu FK Eksikliği (Orphaned Country Assignments)
*   **Hata:** `country_assignments` tablosunda `country_code` için `countries(code)` referans kısıtlamasının olmaması ve geçersiz ülke tanımlanabilmesi.
*   **Çözüm:** `FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE RESTRICT` kısıtlaması eklenmiştir.

---

## 2. Güncel Veritabanı Şeması (D1 SQLite)

```sql
-- 1. Ülke Master Tablosu
CREATE TABLE IF NOT EXISTS countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL
);

-- 2. Temsilciler Tablosu
CREATE TABLE IF NOT EXISTS representatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    representative_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    drive_folder_id TEXT, -- Temsilcinin Google Drive'daki kök klasör ID'si (REP_ID_[id] formatında)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Atamalar Tablosu (Geliştirilmiş)
CREATE TABLE IF NOT EXISTS country_assignments (
    country_code TEXT PRIMARY KEY,
    representative_id INTEGER NOT NULL,
    drive_folder_id TEXT, -- Ülke klasörünün Google Drive ID'si
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE,
    FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE RESTRICT
);

-- 4. Müşteriler Tablosu (Soft Delete Desteğiyle)
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
    deleted_at DATETIME DEFAULT NULL, -- Soft Delete
    FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE RESTRICT
);

-- 5. Teklifler Tablosu (Para Birimi Normalizasyonu ve Soft Delete)
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('USD', 'EUR', 'TRY')),
    amount_usd REAL NOT NULL, -- Raporlama için tek tip para birimi
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    drive_file_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL, -- Soft Delete
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_assignment_rep ON country_assignments(representative_id);
CREATE INDEX IF NOT EXISTS idx_customer_country ON customers(country_code);
CREATE INDEX IF NOT EXISTS idx_quote_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_deleted ON customers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_deleted ON quotes(deleted_at) WHERE deleted_at IS NULL;
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
