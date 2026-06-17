# Yol Haritası: Google Drive Entegrasyonu & Müşteri CRM Mimarisi

Bu belge, dünya haritası temsilci sistemine müşteri kayıtlarının, görüşme notlarının, tekliflerin ve kurumsal Google Drive Workspace entegrasyonunun eklenmesi için hazırlanan nihai mimari tasarım ve geliştirme planıdır.

---

## 1. Veritabanı ve Şema Güncellemeleri (D1 SQLite)

Büyük ve yer kaplayan dosyalar (PDF teklifler, belgeler) Google Drive üzerinde saklanırken, arama, sıralama ve finansal raporlama işlemlerinin milisaniyeler içinde yapılabilmesi için yapısal veriler **Cloudflare D1 veritabanında** tutulacaktır.

### A. Müşteriler (`customers`) Tablosu
```sql
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, -- CUST-1001 formatında otomatik üretilen ID
    name TEXT NOT NULL, -- Ad Soyad / Şirket Adı
    country_code TEXT NOT NULL, -- Harita ile eşleşecek ISO kodu (örn: de, fr)
    representative_id INTEGER NOT NULL, -- Atanan Temsilci ID
    email TEXT,
    phone TEXT,
    address TEXT,
    social_media TEXT, -- Sosyal medya hesabı linki/kullanıcı adı
    product_groups TEXT, -- İlgilenilen ürün grupları
    drive_folder_id TEXT, -- Müşterinin ana Google Drive klasör ID'si
    notes_doc_id TEXT, -- Interview_Notes Google Doc dosyasının ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE RESTRICT
);
```

### B. Teklifler (`quotes`) Tablosu
```sql
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL, -- Teklif Tutarı
    currency TEXT NOT NULL CHECK(currency IN ('USD', 'EUR', 'TRY')), -- Para Birimi
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    drive_file_id TEXT, -- Teklif PDF dosyasının Drive ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

---

## 2. Google Drive Klasör Yapısı ve Otomasyonu

Müşteri oluşturulduğunda sistem arka planda Google Drive API'yi tetikleyerek ilgili yapıyı otomatik kurar.

### A. Klasör Hiyerarşisi
```text
[Temsilci_Kodu]/
└── [Ülke]/
    └── [Müşteri_ID]/
        ├── Quotes/               --> Teklif PDF dosyaları
        ├── Other_Documents/      --> Sözleşmeler, teknik çizimler vb.
        └── Interview_Notes       --> Görüşme Notları (Boş Google Doc)
```

### B. Otomasyon Süreci
1.  **Müşteri Ekleme**: Web panelinden yeni müşteri bilgileri girilip kaydedilir.
2.  **Klasör Üretimi**: Google Drive API kullanılarak temsilcinin ana klasöründe sırasıyla ülke ve `[Müşteri_ID]` klasörleri oluşturulur.
3.  **Alt Klasör & Belge**: Bu klasörün altında `Quotes` ve `Other_Documents` klasörleri ile `Interview_Notes` adında şablondan türetilmiş boş bir Google Doc dökümanı üretilir.
4.  **Veritabanı Eşleşmesi**: Oluşturulan klasör ve döküman ID'leri D1 `customers` tablosuna kaydedilir.

---

## 3. Yetkilendirme (OAuth 2.0)

*   **Google Workspace Entegrasyonu**: Temsilciler sisteme kendi kurumsal Workspace hesaplarıyla (OAuth 2.0) giriş yapacaklardır.
*   **Doğal İzin Korunumu**: Temsilci sadece kendi Google hesabı yetkisinde olan Drive klasörlerini görebilir ve bunlara yükleme yapabilir.
*   **Çift Yönlü Yükleme**: 
    - Arayüzden (Web UI) doğrudan ilgili müşteri kartına dosya yüklenebilir (arka planda ilgili Drive alt klasörüne gider).
    - Temsilci doğrudan Google Drive üzerinde klasöre manuel yüklediği dosyaların linklerini panel kartına manuel olarak da ekleyebilir.

---

## 4. Kullanıcı Arayüzü & CRM Özellikleri

### A. Harita Etkileşimi
*   **Müşteri Listesi**: Ülkeye tıklandığında yan panelde o ülkedeki müşteriler listelenir.
*   **Müşteri Kartı**: Müşteriye tıklandığında; iletişim bilgileri, Google Doc `Interview_Notes` linki (doğrudan yeni sekmede açılır), Drive klasör linkleri ve dosya yükleme alanları görüntülenir.

### B. Müşteri Tablo Görünümü (Temsilci & Admin için)
*   Temsilciler ve adminler, atanmış tüm müşterilerini içeren kapsamlı bir tablo sayfasını açabilirler.
*   **Arama (Search)**: Arama kutusuna müşteri adı, ülke, mail, telefon veya ürün grubu yazıldığında anlık filtreleme yapılır.
*   **Sıralama**: A-Z / Z-A alfabetik sıralama ve tarih bazlı sıralama seçenekleri bulunur.
*   Tablodan bir müşteriye tıklandığında aynı detay kartı açılarak tüm işlemler gerçekleştirilebilir.

### C. Çift Harita Modu
*   **Temsilci Modu**: Haritadaki ülkeler temsilci renklerine göre boyanır (mevcut sistem). **Admin ve Temsilciler** görebilir.
*   **Yoğunluk Haritası Modu (Heatmap)**: Harita, barındırdığı müşteri yoğunluğuna göre gölgelenir (koyu renk = çok müşteri). **Sadece Admin** yetkisine açıktır.

---

## 5. Temsilci Değişikliği (Folder Transfer)

*   Bir ülkenin temsilcisi değiştirildiğinde, sistem arka planda Google Drive API'yi tetikler.
*   O ülkedeki tüm müşteri klasörleri, `Temsilci_A` klasörünün altından `Temsilci_B` klasörünün altına taşınır veya kopyalanır.
*   Google Drive üzerindeki yeni paylaşım izinleri otomatik olarak yeni temsilcinin e-posta yetkisiyle güncellenir.

---

## 🔮 Gelecek Planları (Gelişmiş Otomasyon)

*   **Otomatik Teklif PDF Oluşturucu (Quote Generator)**: Panelde doldurulacak teklif formuna (ürün, fiyat, miktar vb.) göre, kurumsal şablona uygun olarak otomatik teklif PDF'i üretilmesi ve müşterinin Drive `Quotes` klasörüne kaydedilerek veritabanına işlenmesi.

---

## 🚫 Kapsam Dışı Alanlar
*   Google Takvim / Gmail entegrasyonu (Toplantı planlama/Doğrudan mail gönderme).
*   Word/PDF dosyalarının doğrudan web panel içinde açılıp okunması (Google Drive yönlendirmesi kullanılacak).
*   Çevrimdışı çalışma desteği.
