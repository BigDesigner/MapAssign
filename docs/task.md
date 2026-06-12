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

## 🔄 Devam Eden / Bekleyen
- [ ] Cloudflare Pages Web Analytics beacon CORS uyarısı (Cloudflare tarafı, bizim kontrolümüzde değil)

## 📋 Gelecek Görevler (Backlog)
- [ ] Temsilci silme işleminde onay modal'ı yerine daha şık UI
- [ ] Tablo sayfasında temsilciye göre grup filtreleme
- [ ] Harita üzerinde ülke arama/zoom özelliği
- [ ] Mobil görünüm iyileştirmeleri (responsive panel davranışı)
- [ ] Dark/Light mode toggle
- [ ] Atama geçmişi (audit log)
