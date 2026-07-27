-- ============================================================
-- Migrasi: Manajemen Master Supplier & Pemetaan Produk
-- Versi: 001
-- Tanggal: 2026-07-26
-- Deskripsi:
--   1. Membuat tabel 'suppliers' sebagai master data distributor/agen terpusat.
--   2. Menambahkan kolom 'supplier_id' pada tabel 'products', 'inbound_logs',
--      dan 'debts' untuk menggantikan pencatatan free-text.
--   3. Membuat index untuk performa query filter per-supplier.
--   4. Mengaktifkan Row Level Security (RLS) pada tabel suppliers.
-- ============================================================

-- 1. BUAT TABEL MASTER SUPPLIER
-- Menggunakan IF NOT EXISTS agar skrip ini aman untuk dijalankan ulang (idempotent).
CREATE TABLE IF NOT EXISTS public.suppliers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_supplier TEXT      NOT NULL,
    kontak_phone  TEXT,
    alamat        TEXT,
    catatan       TEXT,
    synced        SMALLINT  DEFAULT 1,  -- Di cloud selalu dianggap synced (1)
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TAMBAHKAN KOLOM supplier_id PADA TABEL PRODUCTS
-- ON DELETE SET NULL: Jika supplier dihapus, produknya tidak ikut terhapus
-- (menjadi "orphan product" dengan supplier_id = null, bisa dipetakan ulang).
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 3. TAMBAHKAN KOLOM supplier_id PADA TABEL INBOUND_LOGS
-- Menggantikan kolom supplier_name free-text di dalam JSONB hutang_info.
ALTER TABLE public.inbound_logs
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 4. TAMBAHKAN KOLOM supplier_id PADA TABEL DEBTS
-- Menambahkan relasi struktural sambil mempertahankan kolom supplier_name
-- untuk backward compatibility dengan data hutang lama.
ALTER TABLE public.debts
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 5. BUAT INDEX PERFORMA UNTUK QUERY FILTER PER-SUPPLIER
-- Ketiga index ini memastikan operasi WHERE supplier_id = 'xxx' berjalan O(log n)
-- bukan O(n) scan penuh tabel, penting untuk warung dengan ratusan SKU.
CREATE INDEX IF NOT EXISTS idx_products_supplier_id    ON public.products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inbound_supplier_id     ON public.inbound_logs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_debts_supplier_id       ON public.debts(supplier_id);

-- 6. AKTIFKAN ROW LEVEL SECURITY (RLS) PADA TABEL SUPPLIERS
-- Mengikuti pola keamanan tabel-tabel lainnya di proyek ini.
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Izinkan semua user yang terautentikasi untuk membaca, menulis, dan menghapus.
-- (Akses level dikelola di sisi aplikasi melalui role admin/kasir)
DROP POLICY IF EXISTS "Allow authenticated full access on suppliers" ON public.suppliers;
CREATE POLICY "Allow authenticated full access on suppliers"
    ON public.suppliers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 7. BUAT TRIGGER UNTUK AUTO-UPDATE 'updated_at' PADA TABEL SUPPLIERS
-- Mengikuti pola yang ada pada tabel products dan tabel lainnya.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER set_suppliers_updated_at
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
