-- ============================================================
-- Migrasi: Perbaikan Skema Tabel inbound_logs
-- Versi: 002
-- Tanggal: 2026-07-27
-- Deskripsi:
--   Menyelaraskan skema tabel 'inbound_logs' di Supabase PostgreSQL
--   dengan struktur objek 'logDocument' yang dibentuk oleh frontend
--   (Inbound.jsx & ApprovalInbound.jsx).
--
--   AKAR MASALAH:
--   Kolom-kolom yang dibuat oleh frontend tidak terdefinisi di Supabase,
--   sehingga PostgREST menolak seluruh payload UPSERT dengan HTTP 400
--   dan data riwayat inbound tidak pernah masuk ke database cloud.
--
--   Seluruh perintah menggunakan IF NOT EXISTS / DO $$ PERFORM $$
--   agar skrip ini aman untuk dijalankan ulang (idempotent).
-- ============================================================


-- ── BAGIAN 1: TAMBAHKAN KOLOM-KOLOM YANG HILANG ──────────────────────────────

-- 1.1 total_sku: Jumlah SKU berbeda dalam satu sesi inbound
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS total_sku INTEGER DEFAULT 0;

-- 1.2 total_barang: Total unit fisik seluruh barang yang masuk
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS total_barang INTEGER DEFAULT 0;

-- 1.3 total_nilai: Total nilai HPP (Harga Pokok Pembelian) seluruh barang
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS total_nilai NUMERIC(15, 2) DEFAULT 0;

-- 1.4 sumber_dana: Metode pembayaran ('Kas Tunai' / 'Hutang')
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS sumber_dana TEXT DEFAULT 'Kas Tunai';

-- 1.5 catatan: Catatan/keterangan inbound dari kasir/owner
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS catatan TEXT;

-- 1.6 kasir_nama: Nama lengkap kasir/owner yang membuat inbound
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS kasir_nama TEXT;

-- 1.7 expense_id: Referensi ke tabel 'expenses' (untuk pembayaran Kas Tunai)
--     Menggunakan TEXT (bukan UUID) karena kolom 'id' di tabel expenses bertipe TEXT.
--     Dexie.js menyuntikkan UUID sebagai string ke dalam kolom ++id (auto-increment),
--     sehingga Supabase menyimpannya sebagai TEXT, bukan tipe UUID native PostgreSQL.
--     FK constraint UUID→TEXT tidak kompatibel, sehingga disimpan sebagai plain TEXT reference.
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS expense_id TEXT DEFAULT NULL;

-- 1.8 debt_id: Referensi ke tabel 'debts' (untuk pembayaran Hutang)
--     Alasan sama: kolom 'id' di tabel debts bertipe TEXT di Supabase.
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS debt_id TEXT DEFAULT NULL;

-- 1.9 cancelled_at: Epoch timestamp (ms) saat inbound dibatalkan/dianulir
--     Menggunakan BIGINT untuk menyimpan epoch miliseconds dari frontend (Date.now())
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS cancelled_at BIGINT DEFAULT NULL;

-- 1.10 cancelled_by: Nama operator yang membatalkan/menggulung kembali inbound
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS cancelled_by TEXT DEFAULT NULL;

-- 1.11 hutang_info: Objek JSON berisi detail termin hutang supplier
--      (supplier_id, supplier_name, due_date)
--      Menggunakan JSONB agar dapat di-query dan diindeks secara efisien
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS hutang_info JSONB DEFAULT NULL;

-- 1.12 items: Array JSON berisi rincian setiap barang yang masuk
--      (product_id, nama, barcode, qty_masuk, stok_sebelumnya, stok_sesudahnya, subtotal_hpp)
--      Field ini mungkin sudah ada di Supabase jika sudah pernah dibuat manual,
--      pernyataan IF NOT EXISTS menjamin keamanan penjalanaan ulang.
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 1.13 status: Status alur persetujuan ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- 1.14 synced: Flag sinkronisasi lokal (selalu 1 di cloud = sudah synced)
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS synced SMALLINT DEFAULT 1;


-- ── BAGIAN 2: TAMBAHKAN INDEX UNTUK PERFORMA QUERY ───────────────────────────

-- Index pada kolom status untuk query filter cepat (WHERE status = 'PENDING')
CREATE INDEX IF NOT EXISTS idx_inbound_logs_status
    ON public.inbound_logs(status);

-- Index pada kolom expense_id untuk JOIN/lookup referensi keuangan
CREATE INDEX IF NOT EXISTS idx_inbound_logs_expense_id
    ON public.inbound_logs(expense_id);

-- Index pada kolom debt_id untuk JOIN/lookup referensi hutang
CREATE INDEX IF NOT EXISTS idx_inbound_logs_debt_id
    ON public.inbound_logs(debt_id);

-- Index pada kolom timestamp untuk query ORDER BY terbaru (sudah ada dari migrasi sebelumnya)
-- Ditambahkan IF NOT EXISTS sebagai jaring pengaman
CREATE INDEX IF NOT EXISTS idx_inbound_logs_timestamp
    ON public.inbound_logs(timestamp);


-- ── BAGIAN 3: ROW LEVEL SECURITY (RLS) ───────────────────────────────────────

-- Aktifkan RLS pada tabel inbound_logs
-- Jika sudah aktif, perintah ini tidak akan mengganggu state yang ada
ALTER TABLE public.inbound_logs ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada, lalu buat ulang dengan definisi yang benar
-- Mengikuti pola yang sama dengan tabel 'suppliers' (migrasi 001)
DROP POLICY IF EXISTS "Allow authenticated full access on inbound_logs" ON public.inbound_logs;

CREATE POLICY "Allow authenticated full access on inbound_logs"
    ON public.inbound_logs
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
