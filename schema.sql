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

-- 4. Müşteriler Tablosu (Temsilci Soft Delete Desteğiyle)
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
    deleted_at DATETIME DEFAULT NULL, -- Soft Delete tarihi
    deleted_by_representative_id INTEGER DEFAULT NULL, -- Silen temsilci
    FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE RESTRICT,
    FOREIGN KEY (deleted_by_representative_id) REFERENCES representatives(id) ON DELETE SET NULL
);

-- 5. Teklifler Tablosu (Soft Delete Desteğiyle)
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL CHECK(currency IN ('USD', 'EUR', 'TRY')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    drive_file_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    deleted_by_representative_id INTEGER DEFAULT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (deleted_by_representative_id) REFERENCES representatives(id) ON DELETE SET NULL
);

-- 6. Arka Plan İş Kuyruğu Tablosu (CF Workers CPU ve Kota Dostu)
CREATE TABLE IF NOT EXISTS background_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL CHECK(job_type IN ('create_customer_folders', 'move_country_folders', 'archive_customer_folders')),
    payload TEXT NOT NULL, -- JSON formatında işlem verileri (örn: { "customer_id": 123 })
    status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_assignment_rep ON country_assignments(representative_id);
CREATE INDEX IF NOT EXISTS idx_customer_country ON customers(country_code);
CREATE INDEX IF NOT EXISTS idx_quote_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_deleted ON customers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_deleted ON quotes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_status ON background_jobs(status);
