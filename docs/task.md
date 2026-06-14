# MapAssign — Görev Listesi (Backlog)

## ✅ Tamamlanan
- [x] SVG dünya haritası ile admin/temsilci giriş sistemi
- [x] Ülke üzerine gelince tooltip ile isim gösterme
- [x] Admin: ülkeleri temsilcilere atama (panel üzerinden)
- [x] Temsilci: kendi atanmış ülkelerini görme (alfabetik panel)
- [x] Temsilci: kendi şifresini değiştirebilme (menü içinden)
- [x] Admin: temsilci oluşturma, düzenleme, silme (CRUD panel)
- [x] Admin: temsilciye ülke ekleme/çıkarma (+/- butonları)
- [x] Sol panelleri dikey sidebar'da üst üste binmeden sıralama
- [x] PDF dışa aktarma butonu
- [x] `hashPassword` dynamic import bug düzeltmesi
- [x] Tablo sayfası (`table.html`) — admin + temsilci için
- [x] CSV indirme özelliği
- [x] Docs klasörü (agent.md, guardrails.md, task.md, architecture.md)
- [x] Sayfa yenilemede oturum koruma (`GET /api/auth/me` session restore)
- [x] Menüler ve tooltipler kaybolma bug'ının çözülmesi (Eksik DOM ID'lerinden kaynaklanan TypeError çökmesi giderildi)
- [x] Temsilcilerin kendi panellerinde sadece kendi ülkelerini listelerken harita ve tabloda tüm atamaları görebilmesi
- [x] İskoçya sınırları içerisindeki pembe nokta ve bölge sınır çizgilerinin temizlenmesi
- [x] Admin panelinde temsilci kodu (kullanıcı adı) düzenleme desteği
- [x] Temsilci listesinde ve legend kısmında her temsilcinin kaç ülkeye atandığının gösterilmesi `(X ülke)`
- [x] Somaliland (`XS`), Kosova (`XK`) ve Kuzey Kıbrıs (`XC`) ülke mapping'lerinin ve isimlerinin eklenmesi
- [x] Footer alanının "Design & Development: GNNlabs" olarak İngilizceye çevrilmesi ve PNG export için upscale özelliğinin devre dışı bırakılması
- [x] SVG haritada Somaliland (`xs-`), Kosova (`xk-`) ve Kuzey Kıbrıs (`xc-`) path'lerinin görünür kılınması ve renklendirilebilir hale getirilmesi
- [x] Kıbrıs (`CY`), Somaliland ve Kosova için iç içe (nested) ülke renklendirme ve üzerine gelme (hover) çakışmalarının çözülmesi (Kuzey Kıbrıs renklendirildiğinde Güney Kıbrıs'ın veya tam tersinin etkilenmemesi)
- [x] Admin panelinde temsilci silme butonunun belirginleştirilmesi (arka plan renginin koyu kırmızı yapılması ve simge olarak temiz bir beyaz unicode `✕` kullanılması)
- [x] Temsilci silme işleminde tarayıcının standart onay kutusu (`confirm`) yerine koyu/glassmorphic temayla uyumlu şık ve özel onay modalı (`#confirm-modal`)
- [x] Tablo sayfasında (`table.html`) ataması olan temsilcilere göre dinamik satır filtreleme dropdown'ı (`#rep-filter`)

## 🔄 Devam Eden / Bekleyen
- [ ] Cloudflare Pages Web Analytics beacon CORS uyarısı (Cloudflare tarafı, bizim kontrolümüzde değil)

## 📋 Gelecek Görevler (Backlog)
- [ ] Harita üzerinde ülke arama/zoom özelliği
- [ ] Mobil görünüm iyileştirmeleri (responsive panel davranışı)
- [ ] Dark/Light mode toggle
- [ ] Atama geçmişi (audit log)

### 🇹🇷 Türkiye Haritası & Türkçe Dil Desteği Entegrasyonu
- [ ] Veritabanında `scope` (world/turkey) alanlarının tanımlanması ve migrasyonu
- [ ] Kapsam bazlı temsilci ve atama API'lerinin güncellenmesi
- [ ] Türkiye illerini içeren `turkey.svg` haritasının ve `cityNames.ts` dosyasının eklenmesi
- [ ] Arayüzde Dünya/Türkiye geçiş özelliğinin ve dinamik Türkçe/İngilizce dil motorunun kurulması

