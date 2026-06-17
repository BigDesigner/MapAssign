# Yol Haritası: Google Drive Entegrasyonu & Müşteri CRM Mimarisi

Bu belge, dünya haritası temsilci sistemine müşteri kayıtlarının, görüşme notlarının, tekliflerin ve kurumsal Google Drive Workspace entegrasyonunun eklenmesi için hazırlanan, mantıksal hatalardan arındırılmış nihai mimari tasarım ve geliştirme planıdır.

---

## 1. Veritabanı ve Şema Güncellemeleri (D1 SQLite)

Büyük ve yer kaplayan dosyalar (PDF teklifler, belgeler) Google Drive üzerinde saklanırken, arama, sıralama ve finansal raporlama işlemlerinin milisaniyeler içinde yapılabilmesi için yapısal veriler **Cloudflare D1 veritabanında** tutulacaktır.

### A. Müşteriler (`customers`) Tablosu
Müşterinin temsilci bilgisi, bulunduğu ülke atamasından dinamik olarak türetilecektir (`country_assignments` ile JOIN). `FOREIGN KEY` kısıtlaması ile master `countries` tablosuna bağlanarak güvenli veri bütünlüğü sağlanır. Ülke atamasının silinmesi veya değiştirilmesi müşteri kayıtlarını kilitlemez. Müşteri ID'si SQLite'ın güvenli `AUTOINCREMENT` özelliği ile üretilir. Temsilciler silme işlemi yaptığında müşteri fiziksel silinmez, `deleted_at` ve `deleted_by_representative_id` doldurularak pasifleştirilir.

```sql
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- CUST-1001 formatında frontend/API düzeyinde sunulur
    country_code TEXT NOT NULL, -- Harita ile eşleşecek ISO kodu (örn: DE)
    name TEXT NOT NULL, -- Ad Soyad / Şirket Adı
    email TEXT,
    phone TEXT,
    address TEXT,
    social_media TEXT, -- Sosyal medya hesabı linki/kullanıcı adı
    product_groups TEXT, -- İlgilenilen ürün grupları
    drive_folder_id TEXT, -- Müşterinin ana Google Drive klasör ID'si
    notes_doc_id TEXT, -- Interview_Notes Google Doc dosyasının ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL, -- Soft Delete tarihi
    deleted_by_representative_id INTEGER DEFAULT NULL, -- Silen temsilci
    FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE RESTRICT,
    FOREIGN KEY (deleted_by_representative_id) REFERENCES representatives(id) ON DELETE SET NULL
);
```

### B. Teklifler (`quotes`) Tablosu
Tekliflerin raporlama aşamasında para birimlerinin birbirine karışmaması için döviz çevrimi yapılmaz, raporlama ekranında her bir para birimi (USD, EUR, TRY) ayrı satırlarda gruplanarak gösterilir.

```sql
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL, -- Teklif Tutarı
    currency TEXT NOT NULL CHECK(currency IN ('USD', 'EUR', 'TRY')), -- Para Birimi
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    drive_file_id TEXT, -- Teklif PDF dosyasının Drive ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL, -- Soft Delete
    deleted_by_representative_id INTEGER DEFAULT NULL, -- Silen temsilci
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (deleted_by_representative_id) REFERENCES representatives(id) ON DELETE SET NULL
);
```

---

## 2. Google Drive Klasör Yapısı ve Otomasyonu

Müşteri oluşturulduğunda sistem arka planda Google Drive API'yi tetikleyerek ilgili yapıyı otomatik kurar.

### A. Klasör Hiyerarşisi
```text
[Ortak Shared Drive Root]/
├── _Archive/                 --> Sadece Adminin gördüğü arşiv alanı (Fiziksel silme yerine buraya taşınır)
└── [Temsilci_Kodu]/
    └── [Ülke_Kodu]/ (örn: DE)
        └── [Müşteri_Kodu]/ (örn: CUST-1001)
            ├── Quotes/               --> Teklif PDF dosyaları
            ├── Other_Documents/      --> Sözleşmeler, teknik çizimler vb.
            └── Interview_Notes       --> Görüşme Notları (Boş Google Doc)
```

### B. Otomasyon Süreci
### B. Otomasyon Süreci (Arka Plan İş Kuyruğu)
1.  **Müşteri Ekleme**: Web panelinden yeni müşteri bilgileri girilip kaydedilir. API veriyi D1 veritabanına yazar.
2.  **Kuyruğa Ekleme**: Ağır Google Drive işlemleri Workers CPU sınırlarını aşmamak için `background_jobs` kuyruğuna atılır ve `ctx.waitUntil()` ile asenkron olarak arka planda hemen tetiklenir. API temsilciye 10ms içinde başarılı yanıt döner.
3.  **Arka Plan Klasör Üretimi**: Google Drive API kullanılarak temsilcinin kök klasöründe sırasıyla ülke ve `[Müşteri_Kodu]` klasörleri, alt klasörleri ve `Interview_Notes` Google Doc belgesi paralel olarak (`Promise.all()`) oluşturulur.
4.  **Veritabanı Eşleşmesi**: Arka plan işi tamamlandığında klasör ve döküman ID'leri D1 `customers` tablosuna güncellenerek kaydedilir.

---

## 3. Yetkilendirme ve Güvenlik (Workspace Service Account & İzin Kalıtımı)

*   **Merkezi Hizmet Hesabı (Service Account)**: Google Drive API işlemleri, tüm organizasyon dosyaları üzerinde yetkili bir Google Service Account kimliğiyle backend üzerinden gerçekleştirilir. Dosyalar kişilerin değil, kurumun ortak alanında (Shared Drive) saklanır.
*   **Kalıtımsal İzin Yönetimi (Root-Only Sharing)**: Temsilciler için tek tek ülke veya müşteri düzeyinde ayrı ayrı klasör/dosya paylaşımları yapılmayacaktır. Yetkiler sadece temsilcinin kök klasörü olan `[Temsilci_Kodu]/` (veya `REP_ID_[id]`) üzerinden temsilcinin e-postasına verilir. Altındaki tüm ülke ve müşteri klasörleri, erişim yetkilerini **Google Drive kalıtım (inheritance)** mekanizmasıyla otomatik devralır. Bu sayede dosya başına 1000 izin limiti gibi sınırlar asla aşılmaz.
*   **Güvenli Taşıma ve Erişim Değişimi**: Temsilci değişikliklerinde veya arşivlemede, ülke veya müşteri klasörünün `parents` ebeveyn ID'si güncellenerek klasör taşınır. Taşıma anında eski temsilcinin erişimi anında kesilir ve yeni temsilcinin yetkisi kalıtım yoluyla otomatik başlar.

---

## 4. Kullanıcı Arayüzü & CRM Özellikleri

### A. Harita Etkileşimi
*   **Müşteri Listesi**: Ülkeye tıklandığında yan panelde o ülkedeki müşteriler listelenir.
*   **Müşteri Kartı**: Müşteriye tıklandığında; iletişim bilgileri, Google Doc `Interview_Notes` linki (doğrudan yeni sekmede açılır), Drive klasör linkleri ve dosya yükleme alanları görüntülenir.

### B. Müşteri Tablo Görünümü & Rol Bazlı İzolasyon
*   Temsilciler ve adminler, kapsamlı bir tablo sayfasını açabilirler.
*   **Veri İzolasyonu**: Temsilciler sadece kendilerine atanmış ülkelerdeki müşterileri görebilirken, Admin tüm müşterileri listeleyebilir.
*   **Kararlı Arama (Search)**: Yarış durumlarını (Race Condition) tamamen önlemek için arama kutusuna yazılan her karakterde filtreleme yapılmaz. Arama işlemi, arama kutusunun yanındaki **"Ara" (Search) butonuna tıklandığında** veya **Enter tuşuna basıldığında** tetiklenir.
*   **Sıralama**: A-Z / Z-A alfabetik sıralama ve tarih bazlı sıralama seçenekleri bulunur.

### C. Çift Harita Modu
*   **Temsilci Modu**: Haritadaki ülkeler temsilci renklerine göre boyanır (mevcut sistem). **Admin ve Temsilciler** görebilir.
*   **Yoğunluk Haritası Modu (Heatmap)**: Harita, barındırdığı müşteri yoğunluğuna göre gölgelenir (koyu renk = çok müşteri). **Sadece Admin** yetkisine açıktır.

---

## 🚫 Kapsam Dışı Alanlar
*   Google Takvim / Gmail entegrasyonu (Toplantı planlama/Doğrudan mail gönderme).
*   Word/PDF dosyalarının doğrudan web panel içinde açılıp okunması (Google Drive yönlendirmesi kullanılacak).
*   Çevrimdışı çalışma desteği.
*   Türkiye İl bazlı atamalar (farklı bir kolda çalışılacaktır).
