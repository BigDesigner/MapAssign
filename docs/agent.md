# MapAssign — Agent Context

## Proje Nedir?
Temsilci-ülke atama yönetim sistemi. Admin harita üzerinde ülkeleri temsilcilere atar. Temsilciler kendi atanmış ülkelerini görebilir.

## Teknoloji Yığını
| Katman | Teknoloji |
|---|---|
| Frontend | Vanilla HTML/CSS/TypeScript + Vite |
| Backend | Cloudflare Workers (TypeScript) |
| Veritabanı | Cloudflare D1 (SQLite) |
| Session | Cloudflare KV |
| Hosting | Cloudflare Pages (frontend) + Workers (backend) |

## Dizin Yapısı
```
MapAssign/
├── backend/
│   ├── index.ts          # Ana Worker — tüm API route'ları burada
│   ├── auth.ts           # PBKDF2 tabanlı şifre hash/verify
│   ├── session.ts        # KV-based session yönetimi
│   ├── rateLimit.ts      # IP rate limiting
│   └── validation.ts     # Input sanitization
├── frontend/
│   ├── index.html        # Ana uygulama (harita + paneller)
│   ├── table.html        # Atama tablo görünümü (standalone)
│   ├── src/
│   │   ├── main.ts       # AppController sınıfı — tüm UI mantığı
│   │   ├── mapEngine.ts  # SVG harita pan/zoom/renk motoru
│   │   ├── pdfExport.ts  # PDF dışa aktarma
│   │   └── countryNames.ts # ISO kodu → Türkçe isim map
│   └── vite.config.ts    # Multi-page build: index.html + table.html
├── docs/                 # Proje dokümantasyonu
├── schema.sql            # D1 veritabanı şeması
└── wrangler.toml         # Cloudflare deployment konfigürasyonu
```

## API Endpoint'leri
| Method | Path | Auth | Açıklama |
|---|---|---|---|
| POST | /api/auth/login | — | Admin veya temsilci girişi |
| POST | /api/auth/logout | Session | Oturumu sonlandırır |
| GET | /api/map/state | Admin | Tüm atamalar |
| GET | /api/representative/state | Rep | Kendi atanmış ülkeleri |
| POST | /api/representative/change-password | Rep | Şifre değiştirme |
| POST | /api/admin/assign | Admin | Ülke atama/kaldırma |
| POST | /api/admin/representatives | Admin | action: list/create/update/delete |

## Ortam Değişkenleri (Cloudflare Secrets)
- `ADMIN_USERNAME` — Admin kullanıcı adı (default: "admin")
- `ADMIN_PASSWORD_HASH` — PBKDF2 hash (scripts/hash-password.ts ile oluştur)
- `ALLOWED_ORIGIN` — Ek CORS origin'leri (virgülle ayrılmış)

## Deployment
```bash
# Backend deploy
wrangler deploy

# Frontend build + deploy (Cloudflare Pages otomatik yapar)
npm --prefix frontend run build
git push origin main
```

## URL'ler
- Frontend: https://map.akansu.com (Cloudflare Pages)
- Backend API: https://map-api.akansu.com (Cloudflare Workers)
