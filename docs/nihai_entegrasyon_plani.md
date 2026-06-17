# Nihai Entegrasyon Planı: Google Drive & Müşteri CRM & Türkiye Haritası

Bu doküman; dünya haritası temsilci atama sistemine entegre edilecek olan **Google Drive (Workspace)**, **Müşteri CRM mimarisi** ve **Türkiye Haritası (İl bazlı atama & Yerelleştirme)** modüllerinin birleştirilmiş, mantıksal hatalardan arındırılmış nihai planıdır.

---

## 1. Tespit Edilen Mantık Hataları ve Çözümleri

Mevcut yol haritaları ve şemalar üzerinde yapılan detaylı incelemede aşağıdaki mantıksal ve mimari tutarsızlıklar tespit edilmiş ve bu nihai planda giderilmiştir:

### A. Şemadaki Temsilci ID Gereksizliği (Redundancy) & İlişki Çakışması
*   **Hata:** `customers` tablosunda doğrudan `representative_id` saklanması planlanmıştı. Ancak haritada bir ülkenin/ilin temsilcisi değiştirildiğinde, o ülkedeki müşterilerin temsilci bilgisinin de güncellenmesi gerekir. Bu durum çift veri yazımına, senkronizasyon hatalarına ve temsilci silinirken yabancı anahtar kısıtlaması (Foreign Key Deadlock) oluşmasına yol açar.
*   **Çözüm:** `customers` tablosundan `representative_id` kaldırılmıştır. Bir müşterinin temsilcisi, bulunduğu ülkeye/ile atanan temsilcidir. Sorgulama sırasında `assignments` tablosu üzerinden dinamik `JOIN` yapılacaktır. Böylece temsilci ataması değiştiğinde müşteriler otomatik olarak yeni temsilciye bağlanır.

### B. CUST-1001 Formatında Metinsel Birincil Anahtar
*   **Hata:** Müşteri ID'sinin `customers` tablosunda `CUST-1001` gibi metinsel formatta tutulması ve ardışık üretilmesi planlanmıştı. SQLite üzerinde eşzamanlı (concurrent) kayıtlarda bu formatta çakışma (race condition) yaşamadan güvenli artırım yapmak zordur.
*   **Çözüm:** `id` alanı veritabanında standart `INTEGER PRIMARY KEY AUTOINCREMENT` olarak tutulacaktır. Arayüzde veya API yanıtlarında bu değer dinamik olarak `CUST-` prefix'i ve pad/offset eklenerek (`CUST-1001` vb.) formatlanacaktır.

### C. Google Drive Yetkilendirme Kısıtı (OAuth 2.0 vs. Service Account)
*   **Hata:** Temsilcilerin sadece kendi kişisel OAuth 2.0 token'ları ile işlem yapması planlanmıştı. Bu durumda, bir ülkenin temsilcisi değiştirildiğinde (A temsilcisinden B temsilcisine), A temsilcisi çevrimdışı ise veya klasör yetkisini vermemişse, Admin veya B temsilcisi bu dosyaları Google Drive üzerinde taşıyamaz (Owner/Permission Lockout).
*   **Çözüm:** Google Workspace bünyesinde bir **Shared Drive (Ortak Drive)** kurulacaktır. Cloudflare Workers backend'i, bu Shared Drive üzerinde tam yetkili bir **Google Service Account** (servis hesabı) ile çalışacaktır. Temsilcilerin erişimleri ise bu servis hesabı tarafından klasör yetkilendirme API'leri ile yönetilecektir. Bu sayede dosya taşıma, silme ve oluşturma işlemleri temsilciler çevrimdışı olsa bile sorunsuz yürütülür.

### D. Google Drive Klasör ID Takibi (Performans Kısıtı)
*   **Hata:** Klasör taşımalarında ve müşteri işlemlerinde Google Drive üzerinde sürekli isim bazlı (path) klasör araması yapılması planlanmıştı. Bu durum yüksek API gecikmesine ve rate-limit hatalarına yol açar.
*   **Çözüm:** Google Drive'da her klasör benzersiz bir ID'ye sahiptir. Bu nedenle `representatives` (temsilci kök klasörü) ve `assignments` (ülke/il klasörü) tablolarına `drive_folder_id` alanları eklenmiştir. Temsilci değiştiğinde, ülkenin klasör ID'si servis hesabı aracılığıyla tek bir API çağrısıyla yeni temsilcinin klasör ID'sine taşınır.

### E. Bölgesel Raporlama Verisi Eksikliği
*   **Hata:** "Avrupa bölgesinde toplam ne kadarlık teklif verildi?" gibi bölgesel analizlerin D1 SQL sorgusuyla yapılması hedeflenmişti ancak veritabanında ülkelerin hangi bölgede/kıtada olduğuna dair bir veri modeli yoktu.
*   **Çözüm:** Veritabanına ülkelerin ISO kodlarını ve bölgelerini (Europe, Asia, North America vb.) içeren statik bir `countries` tablosu eklenmiştir.

### F. Veri İzolasyonu (Data Isolation) Eksikliği
*   **Hata:** Temsilcilerin de tüm müşterileri içeren tablo görünümüne erişebileceği belirtilmişti. Bu durum veri gizliliği ihlaline yol açabilir.
*   **Çözüm:** API düzeyinde rol bazlı yetkilendirme uygulanacaktır. Temsilci rolündeki kullanıcılar sadece kendi atandıkları bölgelerdeki müşterilerin verilerini görebilecek, Admin ise tüm veritabanına erişebilecektir.

---

## 2. Güncel Veritabanı Şeması (D1 SQLite)

Tüm kapsamları (Dünya ve Türkiye) ve CRM modülünü destekleyen birleştirilmiş veritabanı şeması:

```sql
-- 1. Ülke Master Tablosu (Bölgesel Raporlama İçin)
CREATE TABLE IF NOT EXISTS countries (
    code TEXT PRIMARY KEY, -- 'DE', 'FR', 'TR' vb.
    name TEXT NOT NULL, -- Ülke ismi
    region TEXT NOT NULL -- 'Europe', 'Asia', 'Africa', 'Americas' vb.
);

-- 2. Temsilciler Tablosu (Genişletilmiş)
CREATE TABLE IF NOT EXISTS representatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    representative_code TEXT NOT NULL UNIQUE, -- 'REP01' vb.
    name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    map_scope TEXT CHECK(map_scope IN ('world', 'turkey')) NOT NULL DEFAULT 'world',
    drive_folder_id TEXT, -- Temsilcinin Google Drive'daki kök klasör ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Atamalar Tablosu (Dünya ve Türkiye Ortak)
CREATE TABLE IF NOT EXISTS assignments (
    map_scope TEXT CHECK(map_scope IN ('world', 'turkey')) NOT NULL,
    region_code TEXT NOT NULL, -- Dünya için Ülke Kodu (örn. 'DE'), Türkiye için İl Kodu (örn. 'TR-34')
    representative_id INTEGER NOT NULL,
    drive_folder_id TEXT, -- Ülke/İl klasörünün Google Drive ID'si
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (map_scope, region_code),
    FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE
);

-- 4. Müşteriler Tablosu (Normalleştirilmiş)
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    map_scope TEXT CHECK(map_scope IN ('world', 'turkey')) NOT NULL,
    region_code TEXT NOT NULL, -- Dünya için 'DE', Türkiye için 'TR-34'
    name TEXT NOT NULL, -- Müşteri Ad Soyad / Şirket Unvanı
    email TEXT,
    phone TEXT,
    address TEXT,
    social_media TEXT,
    product_groups TEXT, -- İlgilenilen ürün grupları (virgülle ayrılmış veya JSON)
    drive_folder_id TEXT, -- Müşterinin Google Drive klasör ID'si
    notes_doc_id TEXT, -- Interview_Notes Google Doc ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Teklifler Tablosu
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('USD', 'EUR', 'TRY')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    drive_file_id TEXT, -- Teklif PDF dosyasının Drive ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_assignment_rep ON assignments(representative_id);
CREATE INDEX IF NOT EXISTS idx_customer_region ON customers(map_scope, region_code);
CREATE INDEX IF NOT EXISTS idx_quote_customer ON quotes(customer_id);
```

---

## 3. Google Drive Klasör Mimarisi & Servis Hesabı Akışı

### A. Klasör Hiyerarşisi
Shared Drive içinde aşağıdaki klasör yapısı servis hesabı tarafından otomatik oluşturulur:

```text
[Shared Drive Root]/
├── World/ (Dünya Haritası Klasörü)
│   └── [Temsilci_Kodu]/ (örn: REP01)
│       └── [Ülke_Kodu]/ (örn: DE)
│           └── [Müşteri_Kodu]/ (örn: CUST-1001)
│               ├── Quotes/ (Teklif PDF'leri)
│               ├── Other_Documents/ (Diğer evraklar)
│               └── Interview_Notes (Google Doc dosyası)
└── Turkey/ (Türkiye Haritası Klasörü)
    └── [Temsilci_Kodu]/ (örn: TR_REP01)
        └── [İl_Plaka_Kodu]/ (örn: TR-34)
            └── [Müşteri_Kodu]/ (örn: CUST-2001)
                ├── Quotes/
                ├── Other_Documents/
                └── Interview_Notes
```

### B. Otomasyon & Taşıma Algoritması (Temsilci Değişikliği)
Bir ülkenin/ilin temsilcisi `Temsilci_A`'dan `Temsilci_B`'ye geçirildiğinde:
1.  **D1 Güncellemesi:** `assignments` tablosunda ilgili satırın `representative_id` değeri `Temsilci_B.id` olarak güncellenir.
2.  **Drive API Tetiklenmesi:**
    *   İlgili bölge klasörünün ID'si (`assignments.drive_folder_id`) veritabanından çekilir.
    *   Google Drive API kullanılarak, bu klasörün üst parent ID'si `Temsilci_A`'nın klasör ID'sinden çıkarılır ve `Temsilci_B`'nin klasör ID'sine eklenir (tek bir `update` isteğiyle taşınır).
    *   Varsa temsilci bazlı paylaşım yetkileri güncellenir.

---

## 4. Kullanıcı Arayüzü (UI) & Yerelleştirme Entegrasyonu

### A. Kapsam ve Dil Seçimi (i18n)
*   Arayüzün üst barında "Dünya Haritası" ve "Türkiye Haritası" geçişi yer alacaktır.
*   Geçiş yapıldığında:
    *   **Dünya Haritası:** Harita dil dosyası `i18n.ts` üzerinden tüm arayüz metinleri **İngilizce**ye çevrilir ve `world-states.svg` yüklenir.
    *   **Türkiye Haritası:** Tüm arayüz metinleri **Türkçe**ye çevrilir ve `turkey-provinces.svg` yüklenir.
*   Temsilci kendi hesabı ile giriş yaptığında, temsilcinin tanımlı olduğu `map_scope` değerine göre ilgili harita ve dil otomatik yüklenir (temsilciler harita geçişi yapamaz, sadece Admin yapabilir).

### B. Müşteri Tablosu & Arama
*   Tablo görünümünde global bir arama kutusu olacaktır. Arama kutusu; müşteri adı, bölge/ülke kodu, e-posta, telefon ve ürün grupları alanlarında anlık büyük/küçük harf duyarsız (ve Türkçe karakter duyarlı) arama yapacaktır.
*   Temsilciler sadece kendilerine atanan ülkelerdeki/illerdeki müşterileri listeleyebilirken, Admin tüm tabloyu görebilir.

### C. Gelişmiş Admin Raporlama Paneli
*   Admin ekranına eklenecek olan raporlama kartları sayesinde:
    *   Seçilen bölgeye/kıtaya veya ile göre toplam verilen teklif tutarları, onaylanan ve bekleyen tekliflerin oranları grafiksel ve tablosal olarak gösterilir.
    *   Bu raporlar D1 üzerinde tek bir SQL `SUM` ve `GROUP BY` sorgusu ile milisaniyeler içinde çekilir.

### D. Renk Paleti İyileştirmesi (Modern Pastel Seçenekler)
Harita üzerinde göz yormayan, premium bir koyu tema görünümü sağlamak için renk seçicideki varsayılan 12 pastel renk seçeneği şunlardır:
1.  **Yumuşak Mavi:** `#93c5fd`
2.  **Yumuşak Zümrüt:** `#a7f3d0`
3.  **Yumuşak Mor:** `#c4b5fd`
4.  **Yumuşak Gül:** `#fca5a5`
5.  **Yumuşak Turuncu:** `#fed7aa`
6.  **Yumuşak Sarı:** `#fef08a`
7.  **Yumuşak Turkuaz:** `#99f6e4`
8.  **Yumuşak Lavanta:** `#e9d5ff`
9.  **Yumuşak Çimen:** `#d9f99d`
10. **Açık İndigo:** `#c7d2fe`
11. **Yumuşak Somon:** `#fecdd3`
12. **Yumuşak Açık Mavi:** `#a5f3fc`

---

## 5. Uygulama Adımları

1.  **Aşama 1: D1 Veritabanı Güncellemeleri**
    *   `schema.sql` dosyasının yeni yapıya göre düzenlenmesi.
    *   Mevcut temsilci ve atama verilerini bozmadan geçiş yapacak migrasyon adımlarının çalıştırılması.
    *   `countries` tablosunun dünya ülkeleri ve bölge bilgileri ile doldurulması.
2.  **Aşama 2: Google Workspace & Drive Entegrasyonu**
    *   Google Cloud Console üzerinde Service Account oluşturulması ve anahtarının (JSON) Worker secret'larına eklenmesi.
    *   Workspace üzerinde Shared Drive oluşturulması ve Service Account'a "Manager" yetkisi verilmesi.
    *   Worker üzerinde Google Drive API entegrasyon sınıfının yazılması (Klasör oluşturma, Google Doc şablonu kopyalama, klasör taşıma).
3.  **Aşama 3: Backend API Geliştirmesi**
    *   CRM endpoint'lerinin oluşturulması (`/api/crm/customers`, `/api/crm/quotes`, `/api/crm/upload`).
    *   Atama değişikliğinde Drive API tetikleme kancalarının (hooks) entegrasyonu.
    *   API isteklerinde rol bazlı veri izolasyonu filtrelerinin uygulanması.
4.  **Aşama 4: Ön Yüz UI & Türkiye Haritası & i18n Entegrasyonu**
    *   Türkiye il sınırlarını barındıran `turkey-provinces.svg` dosyasının eklenmesi.
    *   `i18n.ts` dil dosyasının oluşturulması ve UI dil yönetiminin bağlanması.
    *   Müşteri detay kartları, tablo görünümü ve gelişmiş raporlama panellerinin sisteme eklenmesi.
