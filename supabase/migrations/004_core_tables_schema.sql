-- ============================================================
-- Migrasi: Skema Lengkap Tabel Inti (Products, Transactions, Shifts, Settings)
-- Versi: 004
-- Tanggal: 2026-07-28
-- Deskripsi:
--   1. Membuat tabel products, transactions, shifts, dan settings di sisi
--      Supabase dengan tipe data yang kompatibel 100% dengan Dexie.js.
--      - Kolom 'id' menggunakan TEXT karena Dexie menginject string UUID atau angka.
--      - Kolom 'timestamp', 'expiry_date', 'start_time', 'end_time', dll
--        menggunakan BIGINT (epoch milliseconds dari Date.now()).
--      - Kolom 'items' pada transactions dan 'value' pada settings bertipe JSONB.
--   2. Mengaktifkan Row Level Security (RLS) pada semua tabel.
--   3. Mendaftarkan tabel ke publikasi Realtime WebSocket (supabase_realtime).
--   4. Membuat index performa untuk mempercepat filter dan pencarian.
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 1: TABEL products (Master Barang & Inventaris)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.products (
    id              TEXT        PRIMARY KEY,
    nama            TEXT        NOT NULL,
    kategori        TEXT,
    harga_jual      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    harga_beli      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    stok            NUMERIC(15, 2) NOT NULL DEFAULT 0,
    satuan          TEXT,
    barcode         TEXT,
    expiry_date     BIGINT,
    supplier_id     UUID        REFERENCES public.suppliers(id) ON DELETE SET NULL,
    min_stok        NUMERIC(15, 2) DEFAULT 5,
    synced          SMALLINT    DEFAULT 1
);

-- Patch kolom jika tabel sudah ada sebelumnya namun kurang kolom tertentu
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stok NUMERIC(15, 2) DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS synced SMALLINT DEFAULT 1;

COMMENT ON TABLE public.products IS 'Master data barang dagangan warung. Menggunakan epoch ms untuk expiry_date.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 2: TABEL transactions (Penjualan / Kasir POS)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transactions (
    id              TEXT        PRIMARY KEY,
    shift_id        TEXT,
    total           NUMERIC(15, 2) NOT NULL DEFAULT 0,
    items           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    payment_method  TEXT        DEFAULT 'Tunai',
    amount_paid     NUMERIC(15, 2) DEFAULT 0,
    kembalian       NUMERIC(15, 2) DEFAULT 0,
    timestamp       BIGINT      NOT NULL,
    synced          SMALLINT    DEFAULT 1
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS shift_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS synced SMALLINT DEFAULT 1;

COMMENT ON TABLE public.transactions IS 'Daftar transaksi penjualan dari POS Kasir. Epoch ms untuk timestamp, JSONB untuk array barang.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 3: TABEL shifts (Sesi Kerja Kasir / Owner)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.shifts (
    id              TEXT        PRIMARY KEY,
    user_id         TEXT,
    nama_kasir      TEXT,
    modal_awal      NUMERIC(15, 2) DEFAULT 0,
    kas_akhir       NUMERIC(15, 2),
    start_time      BIGINT,
    end_time        BIGINT,
    waktu_mulai     BIGINT,
    waktu_selesai   BIGINT,
    catatan         TEXT,
    synced          SMALLINT    DEFAULT 1
);

ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS waktu_mulai BIGINT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS waktu_selesai BIGINT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS synced SMALLINT DEFAULT 1;

COMMENT ON TABLE public.shifts IS 'Sesi buka/tutup shift kasir. Menggunakan epoch ms untuk penanda waktu.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 4: TABEL settings (Konfigurasi Warung / Jam Malam)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.settings (
    key             TEXT        PRIMARY KEY,
    value           JSONB,
    synced          SMALLINT    DEFAULT 1
);

COMMENT ON TABLE public.settings IS 'Pengaturan aplikasi dan konfigurasi warung.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 5: INDEX PERFORMA
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_products_kategori        ON public.products(kategori);
CREATE INDEX IF NOT EXISTS idx_products_barcode         ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id     ON public.products(supplier_id);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp   ON public.transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_shift_id    ON public.transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment     ON public.transactions(payment_method);

CREATE INDEX IF NOT EXISTS idx_shifts_start_time        ON public.shifts(start_time);
CREATE INDEX IF NOT EXISTS idx_shifts_waktu_mulai       ON public.shifts(waktu_mulai);


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 6: ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings     ENABLE ROW LEVEL SECURITY;

-- Policy: products
DROP POLICY IF EXISTS "Allow authenticated full access on products" ON public.products;
CREATE POLICY "Allow authenticated full access on products"
    ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: transactions
DROP POLICY IF EXISTS "Allow authenticated full access on transactions" ON public.transactions;
CREATE POLICY "Allow authenticated full access on transactions"
    ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: shifts
DROP POLICY IF EXISTS "Allow authenticated full access on shifts" ON public.shifts;
CREATE POLICY "Allow authenticated full access on shifts"
    ON public.shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: settings
DROP POLICY IF EXISTS "Allow authenticated full access on settings" ON public.settings;
CREATE POLICY "Allow authenticated full access on settings"
    ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 7: REGISTRASI KE PUBLIKASI REALTIME (WebSocket)
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE
        public.products,
        public.transactions,
        public.shifts,
        public.settings;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Beberapa tabel mungkin sudah terdaftar di supabase_realtime: %', SQLERRM;
END;
$$;
