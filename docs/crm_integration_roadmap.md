# Yol Haritası: Google Drive Entegrasyonu & Müşteri CRM Mimarisi

Bu belge, dünya haritası temsilci sistemine müşteri kayıtlarının, görüşme notlarının, tekliflerin ve kurumsal Google Drive Workspace entegrasyonunun eklenmesi için hazırlanan, mantıksal hatalardan arındırılmış nihai mimari tasarım ve geliştirme planıdır.

---

## 1. Veritabanı ve Şema Güncellemeleri (D1 SQLite)

Büyük ve yer kaplayan dosyalar (PDF teklifler, belgeler) Google Drive üzerinde saklanırken, arama, sıralama ve finansal raporlama işlemlerinin milisaniyeler içinde yapılabilmesi için yapısal veriler **Cloudflare D1 veritabanında** tutulacaktır.

### A. Müşteriler (`customers`) Tablosu
Müşterinin temsilci bilgisi, bulunduğu ülke/il atamasından dinamik olarak türetilecektir. Bu durum veritabanında gereksiz temsilci atama kaydı tutulmasını engeller. Müşteri ID'si SQLite'ın güvenli `AUTOINCREMENT` özelliği ile üretilir.

```sql
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- CUST-1001 formatında frontend/API düzeyinde sunulur
    map_scope TEXT CHECK(map_scope IN ('world', 'turkey')) NOT NULL, -- Harita kapsamı
    region_code TEXT NOT NULL, -- Harita ile eşleşecek ISO veya Plaka kodu (örn: DE, TR-34)
    name TEXT NOT NULL, -- Ad Soyad / Şirket Adı
    email TEXT,
    phone TEXT,
    address TEXT,
    social_media TEXT, -- Sosyal medya hesabı linki/kullanıcı adı
    product_groups TEXT, -- İlgilenilen ürün grupları
    drive_folder_id TEXT, -- Müşterinin ana Google Drive klasör ID'si
    notes_doc_id TEXT, -- Interview_Notes Google Doc dosyasının ID'si
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### B. Teklifler (`quotes`) Tablosu
```sql
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
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
[Ortak Shared Drive Root]/
└── World (veya Turkey)/
    └── [Temsilci_Kodu]/
        └── [Bölge_Kodu]/ (örn: DE, TR-34)
            └── [Müşteri_Kodu]/ (örn: CUST-1001)
                ├── Quotes/               --> Teklif PDF dosyaları
                ├── Other_Documents/      --> Sözleşmeler, teknik çizimler vb.
                └── Interview_Notes       --> Görüşme Notları (Boş Google Doc)
```

### B. Otomasyon Süreci
1.  **Müşteri Ekleme**: Web panelinden yeni müşteri bilgileri girilip kaydedilir.
2.  **Klasör Üretimi**: Google Drive API kullanılarak temsilcinin ana klasöründe sırasıyla ülke ve `[Müşteri_Kodu]` klasörleri oluşturulur.
3.  **Alt Klasör & Belge**: Bu klasörün altında `Quotes` ve `Other_Documents` klasörleri ile `Interview_Notes` adında şablondan türetilmiş boş bir Google Doc dökümanı üretilir.
4.  **Veritabanı Eşleşmesi**: Oluşturulan klasör ve döküman ID'leri D1 `customers` tablosuna kaydedilir.

---

## 3. Yetkilendirme ve Güvenlik (Workspace Service Account)

*   **Merkezi Hizmet Hesabı (Service Account)**: Google Drive API işlemleri, tüm organizasyon dosyaları üzerinde yetkili bir Google Service Account kimliğiyle backend üzerinden gerçekleştirilir. Dosyalar kişilerin değil, kurumun ortak alanında (Shared Drive) saklanır.
*   **Temsilci Erişimlerinin Yönetimi**: Temsilciler kendi kurumsal Google hesaplarıyla sisteme giriş yaptıklarında, servis hesabı sadece temsilcinin yetkili olduğu `[Temsilci_Kodu]` klasörünü temsilci e-posta adresiyle paylaşır (Read/Write izinleri). Temsilciler diğer temsilcilerin dosyalarına erişemez.
*   **Güvenli Taşıma**: Temsilci değişikliklerinde, klasör yetkisi servis hesabı tarafından tek bir API isteği ile taşınır. Eski temsilcinin yetkisi kaldırılıp yeni temsilci yetkilendirilir.

---

## 4. Kullanıcı Arayüzü & CRM Özellikleri

### A. Harita Etkileşimi
*   **Müşteri Listesi**: Ülkeye/İle tıklandığında yan panelde o bölgedeki müşteriler listelenir.
*   **Müşteri Kartı**: Müşteriye tıklandığında; iletişim bilgileri, Google Doc `Interview_Notes` linki (doğrudan yeni sekmede açılır), Drive klasör linkleri ve dosya yükleme alanları görüntülenir.

### B. Müşteri Tablo Görünümü & Rol Bazlı İzolasyon
*   Temsilciler ve adminler, kapsamlı bir tablo sayfasını açabilirler.
*   **Veri İzolasyonu**: Temsilciler sadece kendilerine atanmış ülkelerdeki/illerdeki müşterileri görebilirken, Admin tüm müşterileri listeleyebilir.
*   **Arama (Search)**: Arama kutusuna müşteri adı, bölge, mail, telefon veya ürün grubu yazıldığında anlık filtreleme yapılır.
*   **Sıralama**: A-Z / Z-A alfabetik sıralama ve tarih bazlı sıralama seçenekleri bulunur.

### C. Çift Harita Modu
*   **Temsilci Modu**: Haritadaki ülkeler temsilci renklerine göre boyanır (mevcut sistem). **Admin ve Temsilciler** görebilir.
*   **Yoğunluk Haritası Modu (Heatmap)**: Harita, barındırdığı müşteri yoğunluğuna göre gölgelenir (koyu renk = çok müşteri). **Sadece Admin** yetkisine açıktır.

---

## 5. Temsilci Değişikliği (Folder Transfer)

*   Bir bölgenin temsilcisi değiştirildiğinde, sistem arka planda Google Drive API'yi tetikler.
*   İlgili bölge (ülke/il) klasörü, veritabanında tutulan `drive_folder_id` kullanılarak, `Temsilci_A` klasörünün altından `Temsilci_B` klasörünün altına tek bir API çağrısıyla taşınır.
*   Paylaşım izinleri yeni temsilcinin e-posta adresiyle güncellenir, eski temsilcinin erişimi kaldırılır.

---

## 🚫 Kapsam Dışı Alanlar
*   Google Takvim / Gmail entegrasyonu (Toplantı planlama/Doğrudan mail gönderme).
*   Word/PDF dosyalarının doğrudan web panel içinde açılıp okunması (Google Drive yönlendirmesi kullanılacak).
*   Çevrimdışı çalışma desteği.
