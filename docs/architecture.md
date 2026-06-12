# MapAssign — Sistem Mimarisi

## Genel Bakış

```
┌─────────────────────────────────────────┐
│           Kullanıcı Tarayıcısı          │
│                                         │
│  ┌─────────────────┐  ┌──────────────┐  │
│  │   index.html    │  │  table.html  │  │
│  │  (Harita + UI)  │  │  (Tablo)     │  │
│  └────────┬────────┘  └──────┬───────┘  │
└───────────┼────────────────  ┼──────────┘
            │  HTTPS + Cookie  │
            ▼                  ▼
┌─────────────────────────────────────────┐
│      Cloudflare Workers (Backend)       │
│         map-api.akansu.com              │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  │
│  │  auth   │  │  session │  │  rate  │  │
│  │  .ts    │  │  .ts     │  │ Limit  │  │
│  └─────────┘  └──────────┘  └────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │           index.ts (Router)       │  │
│  │  POST /api/auth/login             │  │
│  │  POST /api/auth/logout            │  │
│  │  GET  /api/map/state (admin)      │  │
│  │  GET  /api/representative/state   │  │
│  │  POST /api/representative/change-password │
│  │  POST /api/admin/assign           │  │
│  │  POST /api/admin/representatives  │  │
│  └───────────────────────────────────┘  │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Cloudflare  │  │  Cloudflare  │
│  D1 (SQLite) │  │  KV Store    │
│              │  │              │
│ representatives  sessions      │
│ country_assignments            │
└──────────────┘  └──────────────┘
```

## Veritabanı Şeması

```sql
representatives (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  representative_code TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  color_hex       TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
)

country_assignments (
  country_code        TEXT PRIMARY KEY,  -- ISO 3166-1 alpha-2
  representative_id   INTEGER NOT NULL,
  assigned_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (representative_id) REFERENCES representatives(id) ON DELETE CASCADE
)
```

## Auth Akışı

```
Kullanıcı → POST /api/auth/login
         → Backend: Admin mı? → Env hash ile PBKDF2 verify
         → Backend: Rep mi?   → D1'den hash çek, PBKDF2 verify
         → Başarılı: KV'ye session token yaz, HttpOnly cookie set
         → Sonraki istekler: Cookie'den token → KV'den session oku
```

## Frontend Mimarisi

```
index.html
└── AppController (main.ts)
    ├── MapEngine (mapEngine.ts)      # SVG pan/zoom, renk
    ├── exportMapToPDF (pdfExport.ts) # html2canvas + jsPDF
    └── COUNTRY_NAMES (countryNames.ts)

table.html (standalone, vanilla JS)
└── apiFetch → /api/map/state (admin) veya
               /api/representative/state (rep)
```

## CORS Politikası

İzin verilen origin'ler:
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://map.akansu.com`
- `https://mapassign.pages.dev`
- `ALLOWED_ORIGIN` env değişkeni (virgülle ayrılmış ekstra)
