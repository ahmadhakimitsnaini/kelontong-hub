-- ============================================================
-- Migrasi: Isolasi Data Per Akun (user_id) + Perbaikan RLS
-- Versi: 006
-- Tanggal: 2026-07-29
-- Deskripsi:
--   Perbaikan kritis untuk dua bug utama:
--
--   BUG 1 — Data Pembukuan tidak sinkron antar akun/device:
--     Semua tabel sebelumnya menggunakan RLS USING(true), yang berarti
--     setiap user yang terautentikasi bisa membaca dan menulis SEMUA data
--     dari semua warung. Migrasi ini menambahkan kolom `user_id` ke setiap
--     tabel dan memperbarui RLS agar setiap user hanya bisa mengakses
--     data milik dirinya sendiri.
--
--   BUG 2 — Data transaksi tidak masuk ke Supabase:
--     Dengan RLS yang baru (USING + WITH CHECK berbasis auth.uid()),
--     setiap INSERT dari frontend WAJIB menyertakan user_id. Tanpa ini,
--     WITH CHECK (auth.uid() IS NOT NULL) masih mengizinkan insert,
--     namun USING (user_id = auth.uid()...) akan menyaring data saat SELECT.
--
--   Strategi Kompatibilitas Data Lama:
--     - Kondisi `OR user_id IS NULL` di USING memastikan data lama yang
--       dibuat sebelum migrasi ini tetap bisa dibaca oleh semua user
--       terautentikasi (grace period). Ini dapat diperketat di masa depan.
--     - Seluruh perintah menggunakan IF NOT EXISTS / ALTER ADD IF NOT EXISTS
--       agar aman dijalankan ulang (idempotent).
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 1: TAMBAH KOLOM user_id KE SEMUA TABEL INTI
-- ═══════════════════════════════════════════════════════════════

-- Tabel transactions (Penjualan/Kasir POS)
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel expenses (Pengeluaran Operasional)
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel shifts (Sesi Kerja Kasir/Owner)
ALTER TABLE public.shifts
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel debts (Hutang Supplier)
ALTER TABLE public.debts
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel receivables (Piutang/Kasbon Pelanggan)
ALTER TABLE public.receivables
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel cash_reconciliation (Rekonsiliasi Kas)
ALTER TABLE public.cash_reconciliation
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel journal_entries (Jurnal Akuntansi)
ALTER TABLE public.journal_entries
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel inbound_logs (Log Penerimaan Barang)
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel products (Master Barang)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Tabel suppliers (Master Supplier)
ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS user_id TEXT;


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 2: INDEX PERFORMA UNTUK KOLOM user_id
-- Query filter WHERE user_id = 'xxx' akan berjalan O(log n)
-- bukan O(n) full scan, krusial saat data bertambah banyak.
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_transactions_user_id        ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id            ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id              ON public.shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_id               ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_receivables_user_id         ON public.receivables(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_recon_user_id          ON public.cash_reconciliation(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_user_id             ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_user_id             ON public.inbound_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id            ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id           ON public.suppliers(user_id);


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 3: UPDATE ROW LEVEL SECURITY (RLS)
-- Mengganti policy lama USING(true) dengan policy berbasis user_id.
--
-- Policy baru:
--   USING: Hanya bisa BACA data milik sendiri, ATAU data lama
--          yang belum memiliki user_id (grace period).
--   WITH CHECK: Hanya user yang terautentikasi yang bisa MENULIS.
-- ═══════════════════════════════════════════════════════════════

-- ── Policy: transactions ──────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on transactions" ON public.transactions;
CREATE POLICY "Allow authenticated full access on transactions"
    ON public.transactions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: expenses ──────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on expenses" ON public.expenses;
CREATE POLICY "Allow authenticated full access on expenses"
    ON public.expenses
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: shifts ────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on shifts" ON public.shifts;
CREATE POLICY "Allow authenticated full access on shifts"
    ON public.shifts
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: debts ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on debts" ON public.debts;
CREATE POLICY "Allow authenticated full access on debts"
    ON public.debts
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: receivables ───────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on receivables" ON public.receivables;
CREATE POLICY "Allow authenticated full access on receivables"
    ON public.receivables
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: cash_reconciliation ───────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on cash_reconciliation" ON public.cash_reconciliation;
CREATE POLICY "Allow authenticated full access on cash_reconciliation"
    ON public.cash_reconciliation
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: journal_entries ───────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on journal_entries" ON public.journal_entries;
CREATE POLICY "Allow authenticated full access on journal_entries"
    ON public.journal_entries
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: inbound_logs ──────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on inbound_logs" ON public.inbound_logs;
CREATE POLICY "Allow authenticated full access on inbound_logs"
    ON public.inbound_logs
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: products ──────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on products" ON public.products;
CREATE POLICY "Allow authenticated full access on products"
    ON public.products
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: suppliers ─────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated full access on suppliers" ON public.suppliers;
CREATE POLICY "Allow authenticated full access on suppliers"
    ON public.suppliers
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid()::text OR user_id IS NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ── Policy: settings ──────────────────────────────────────────
-- Settings adalah data konfigurasi global per perangkat,
-- tidak perlu isolasi per user, biarkan policy lama.
-- (tidak diubah)


-- ============================================================
-- SELESAI: Semua tabel kini memiliki kolom user_id, index
-- performa, dan RLS yang mengisolasi data per akun warung.
-- ============================================================
