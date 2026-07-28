-- ============================================================
-- Migrasi: Skema Lengkap Modul Pembukuan
-- Versi: 003
-- Tanggal: 2026-07-28
-- Deskripsi:
--   Perbaikan menyeluruh sinkronisasi modul "Pembukuan" yang mencakup:
--   1. Membuat tabel debts, receivables, cash_reconciliation,
--      expenses, dan journal_entries di sisi Supabase dengan tipe
--      data yang 100% kompatibel dengan frontend Dexie.js.
--      CATATAN PENTING TIPE DATA:
--      - Kolom 'id' menggunakan TEXT (bukan UUID) karena Dexie.js
--        meng-inject UUID sebagai string melalui kolom ++id (auto-increment).
--        FK constraint UUID→TEXT tidak kompatibel di PostgreSQL,
--        sehingga seluruh primary key di tabel ini bertipe TEXT.
--      - Kolom timestamp (epoch milliseconds dari Date.now() / new Date().getTime())
--        menggunakan BIGINT, bukan TIMESTAMP/DATE, agar tidak ada
--        konversi implisit yang menyebabkan HTTP 400 dari PostgREST.
--   2. Mengaktifkan Row Level Security (RLS) pada semua tabel.
--   3. Mendaftarkan tabel ke publikasi Realtime WebSocket agar event
--      postgres_changes terpancar ke semua perangkat yang terhubung.
--   4. Membuat index performa untuk query filter yang sering digunakan.
--
--   Seluruh perintah menggunakan IF NOT EXISTS / DO $$ agar aman
--   dijalankan ulang (idempotent).
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 1: TABEL debts (Hutang Supplier)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.debts (
    -- Primary Key menggunakan TEXT karena Dexie.js menginjeksikan UUID sebagai string
    id              TEXT        PRIMARY KEY,

    -- Relasi ke master supplier (opsional, NULL jika hutang dicatat manual)
    -- Menggunakan UUID karena tabel suppliers.id bertipe UUID (dibuat oleh Supabase)
    supplier_id     UUID        REFERENCES public.suppliers(id) ON DELETE SET NULL,

    -- Nama supplier (free-text, dipertahankan untuk backward compatibility)
    supplier_name   TEXT        NOT NULL,

    -- Keterangan/deskripsi tagihan hutang
    description     TEXT,

    -- Total nilai hutang (NUMERIC untuk presisi finansial)
    amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Jumlah yang sudah dibayarkan (mendukung cicilan/partial payment)
    paid_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Tanggal jatuh tempo sebagai epoch milliseconds dari Date.now()
    due_date        BIGINT      NOT NULL,

    -- Status tagihan: 'UNPAID' | 'PARTIAL' | 'PAID'
    status          TEXT        NOT NULL DEFAULT 'UNPAID',

    -- Waktu pencatatan sebagai epoch milliseconds
    created_at      BIGINT,

    -- Flag sinkronisasi lokal (di cloud selalu dianggap synced = 1)
    synced          SMALLINT    DEFAULT 1
);

COMMENT ON TABLE public.debts IS 'Hutang warung kepada supplier. Epoch ms untuk due_date dan created_at agar kompatibel dengan Dexie.js frontend.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 2: TABEL receivables (Piutang / Kasbon Pelanggan)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.receivables (
    -- Primary Key TEXT (UUID dari Dexie)
    id              TEXT        PRIMARY KEY,

    -- Nama pelanggan
    customer_name   TEXT        NOT NULL,

    -- Nomor HP pelanggan (untuk pengiriman reminder via WhatsApp)
    customer_phone  TEXT,

    -- Total saldo kasbon aktif
    amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Batas kredit yang diizinkan (0 = tidak ada batas)
    credit_limit    NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Waktu terakhir data diperbarui (epoch ms dari Date.now())
    last_updated    BIGINT      NOT NULL,

    -- Status kasbon: 'ACTIVE' | 'SETTLED'
    status          TEXT        NOT NULL DEFAULT 'ACTIVE',

    -- Flag sinkronisasi lokal
    synced          SMALLINT    DEFAULT 1
);

COMMENT ON TABLE public.receivables IS 'Piutang/kasbon pelanggan warung. Epoch ms untuk last_updated agar kompatibel dengan Dexie.js frontend.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 3: TABEL cash_reconciliation (Rekonsiliasi Kas)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cash_reconciliation (
    -- Primary Key TEXT (UUID dari Dexie)
    id              TEXT        PRIMARY KEY,

    -- Waktu rekonsiliasi dilakukan (epoch ms dari Date.now())
    timestamp       BIGINT      NOT NULL,

    -- Referensi shift (TEXT karena shifts.id juga bertipe TEXT dari Dexie)
    shift_id        TEXT,

    -- Saldo kas menurut sistem (hasil kalkulasi transaksi - pengeluaran)
    system_balance  NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Saldo kas fisik yang dihitung secara manual oleh kasir/owner
    physical_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Selisih antara saldo fisik dan saldo sistem (bisa negatif)
    difference      NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Keterangan/penjelasan jika ada selisih
    note            TEXT,

    -- Flag sinkronisasi lokal
    synced          SMALLINT    DEFAULT 1
);

COMMENT ON TABLE public.cash_reconciliation IS 'Rekonsiliasi kas harian antara saldo sistem vs kas fisik. Epoch ms untuk timestamp agar kompatibel dengan Dexie.js.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 4: TABEL expenses (Pengeluaran Operasional)
-- Dibuat dengan IF NOT EXISTS — aman jika sudah ada sebelumnya.
-- Tujuan: Memastikan skema yang ada di Supabase tidak kurang kolom
-- dibanding yang dikirim oleh frontend.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.expenses (
    id              TEXT        PRIMARY KEY,
    description     TEXT        NOT NULL,
    amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
    -- timestamp sebagai epoch milliseconds dari new Date().getTime()
    timestamp       BIGINT,
    -- Referensi ke shift yang sedang aktif saat pengeluaran dicatat
    shift_id        TEXT,
    synced          SMALLINT    DEFAULT 1
);

-- Tambahkan kolom yang mungkin belum ada di tabel expenses lama
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS shift_id TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS synced SMALLINT DEFAULT 1;

COMMENT ON TABLE public.expenses IS 'Pengeluaran operasional warung (listrik, air, ongkir, dll). Epoch ms untuk timestamp.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 5: TABEL journal_entries (Jurnal Akuntansi)
-- Tabel ini didefinisikan di Dexie versi 2 namun belum ada di cloud.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id              TEXT        PRIMARY KEY,
    -- Waktu entri jurnal (epoch ms)
    timestamp       BIGINT      NOT NULL,
    -- Nama akun dalam buku besar (misal: 'Kas', 'Penjualan', 'HPP')
    account_name    TEXT        NOT NULL,
    -- Tipe entri: 'DEBIT' | 'CREDIT'
    type            TEXT        NOT NULL,
    -- ID record yang menjadi referensi (bisa transaksi, expense, dll)
    reference_id    TEXT,
    -- Tipe referensi: 'transaction' | 'expense' | 'debt' | 'receivable'
    reference_type  TEXT,
    amount          NUMERIC(15, 2) NOT NULL DEFAULT 0,
    description     TEXT,
    synced          SMALLINT    DEFAULT 1
);

COMMENT ON TABLE public.journal_entries IS 'Entri jurnal akuntansi double-entry. Epoch ms untuk timestamp.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 6: INDEX PERFORMA
-- Memastikan query filter/sort yang sering digunakan berjalan O(log n)
-- bukan O(n) full scan.
-- ═══════════════════════════════════════════════════════════════

-- Index untuk tabel debts
CREATE INDEX IF NOT EXISTS idx_debts_status           ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date         ON public.debts(due_date);
CREATE INDEX IF NOT EXISTS idx_debts_supplier_id_fk   ON public.debts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_debts_created_at       ON public.debts(created_at);

-- Index untuk tabel receivables
CREATE INDEX IF NOT EXISTS idx_receivables_status       ON public.receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_last_updated ON public.receivables(last_updated);

-- Index untuk tabel cash_reconciliation
CREATE INDEX IF NOT EXISTS idx_cash_recon_timestamp ON public.cash_reconciliation(timestamp);
CREATE INDEX IF NOT EXISTS idx_cash_recon_shift_id  ON public.cash_reconciliation(shift_id);

-- Index untuk tabel expenses
CREATE INDEX IF NOT EXISTS idx_expenses_timestamp ON public.expenses(timestamp);
CREATE INDEX IF NOT EXISTS idx_expenses_shift_id  ON public.expenses(shift_id);

-- Index untuk tabel journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_timestamp      ON public.journal_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_journal_reference_id   ON public.journal_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_account_name   ON public.journal_entries(account_name);


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 7: ROW LEVEL SECURITY (RLS)
-- Mengikuti pola keamanan yang sudah ada di migrasi 001 dan 002.
-- Policy: Akses penuh untuk semua user yang terautentikasi.
-- Manajemen role Owner/Kasir dikelola di sisi aplikasi.
-- ═══════════════════════════════════════════════════════════════

-- Aktifkan RLS
ALTER TABLE public.debts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries    ENABLE ROW LEVEL SECURITY;

-- Policy: debts
DROP POLICY IF EXISTS "Allow authenticated full access on debts" ON public.debts;
CREATE POLICY "Allow authenticated full access on debts"
    ON public.debts
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy: receivables
DROP POLICY IF EXISTS "Allow authenticated full access on receivables" ON public.receivables;
CREATE POLICY "Allow authenticated full access on receivables"
    ON public.receivables
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy: cash_reconciliation
DROP POLICY IF EXISTS "Allow authenticated full access on cash_reconciliation" ON public.cash_reconciliation;
CREATE POLICY "Allow authenticated full access on cash_reconciliation"
    ON public.cash_reconciliation
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy: expenses
DROP POLICY IF EXISTS "Allow authenticated full access on expenses" ON public.expenses;
CREATE POLICY "Allow authenticated full access on expenses"
    ON public.expenses
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy: journal_entries
DROP POLICY IF EXISTS "Allow authenticated full access on journal_entries" ON public.journal_entries;
CREATE POLICY "Allow authenticated full access on journal_entries"
    ON public.journal_entries
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 8: REGISTRASI KE PUBLIKASI REALTIME (WebSocket)
-- Perintah ini WAJIB agar tabel memancarkan event postgres_changes
-- ke klien yang terhubung via subscribeToRealtime() (WebSocket Supabase).
-- Tanpa pendaftaran ini, perubahan data TIDAK akan diterima oleh
-- perangkat lain secara real-time.
-- ═══════════════════════════════════════════════════════════════

-- Catatan: ALTER PUBLICATION tidak mendukung IF NOT EXISTS.
-- Jika tabel sudah terdaftar, perintah ini akan menghasilkan
-- error yang diabaikan. Gunakan BEGIN/EXCEPTION untuk keamanan.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE
        public.debts,
        public.receivables,
        public.cash_reconciliation,
        public.expenses,
        public.journal_entries;
EXCEPTION
    WHEN OTHERS THEN
        -- Tabel mungkin sudah terdaftar, abaikan error dan lanjutkan.
        RAISE NOTICE 'Beberapa tabel mungkin sudah terdaftar di supabase_realtime: %', SQLERRM;
END;
$$;

-- ============================================================
-- SELESAI: Semua tabel modul Pembukuan kini memiliki skema cloud
-- yang kompatibel dengan frontend, dilindungi oleh RLS, dan
-- terdaftar untuk siaran Realtime WebSocket.
-- ============================================================
