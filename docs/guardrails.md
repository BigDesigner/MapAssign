# MapAssign — Guardrails (Yapılmaması Gerekenler)

## Güvenlik

- ❌ `ADMIN_PASSWORD_HASH` secret'ini kod içine yazma — Cloudflare Dashboard'dan secret olarak ekle
- ❌ Session token'ı localStorage'a koyma — sadece HttpOnly cookie kullanılır
- ❌ CORS `*` açma — sadece whitelist'teki originler kabul edilir
- ❌ SQL injection riski için `env.DB.prepare(...).bind(...)` yerine template literal kullanma
- ❌ Auth kontrolünü atlama — her endpoint `getAuthenticatedSession()` kontrolü yapmalı

## Frontend

- ❌ SVG harita verilerini düzenleme — SVG path'leri Vite bundle'ına dahil edilmiş, kaynak kaybolabilir
- ❌ `pointer-events: none` kaldırmadan sidebar'a yeni mutlak konumlu eleman ekleme — harita tıklamalarını bozar
- ❌ `main.ts` dışında API çağrısı yapmama — tüm fetch işlemleri `apiFetch()` üzerinden geçmeli (credentials)
- ❌ `table.html`'i `index.html`'e gömme — ayrı page olarak kalmalı (session cookie her ikisi için çalışır)

## Backend

- ❌ Dynamic `import()` kullanma Cloudflare Workers'ta — bundler runtime'da bunu desteklemez (daha önce bug yarattı)
- ❌ `hashPassword` yerine başka bir hash yöntemi kullanma — PBKDF2 standardı değiştirilmemeli
- ❌ `ON DELETE CASCADE` kaldırma — temsilci silindiğinde ülke atamaları otomatik temizlenir, bu kasıtlı davranış

## Veritabanı

- ❌ `schema.sql`'i production'da `DROP TABLE` ile çalıştırma — mevcut verileri siler
- ❌ `country_code` sütununu PRIMARY KEY olmaktan çıkarma — bir ülkeye birden fazla temsilci atanmasını engeller

## Deployment

- ❌ `frontend/dist/` klasörünü doğrudan commit etme — Cloudflare Pages CI build yapar
- ❌ `wrangler.toml`'daki `database_id` değiştirilmemeli — production D1 bağlantısı
