-- ============================================================
-- Migrasi: Sistem Multi-Pengguna Per Toko (Store System)
-- Versi: 007
-- Tanggal: 2026-07-30
-- Deskripsi:
--   Perbaikan arsitektur kritis: mengganti isolasi data berbasis
--   user_id menjadi isolasi berbasis store_id, sehingga beberapa
--   pengguna (owner + kasir) dapat berbagi data dalam satu warung.
--
--   Perubahan yang dilakukan:
--   1. Buat tabel 'stores' (master warung)
--   2. Buat tabel 'store_members' (keanggotaan warung)
--   3. Tambah kolom store_id ke semua tabel data
--   4. Migrasi data lama: buat store per user_id unik yang ada
--   5. Update semua RLS policy ke berbasis store_id
--   6. Helper function untuk menghindari circular dependency pada RLS
--   7. Helper function untuk lookup user by email (fitur undang kasir)
--
--   CATATAN PENTING:
--   - Kolom user_id DIPERTAHANKAN (tidak dihapus) sebagai catatan
--     siapa yang membuat record tersebut.
--   - store_id adalah identifier KEPEMILIKAN / AKSES data.
--   - Seluruh perintah menggunakan IF NOT EXISTS agar idempotent.
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 1: TABEL STORES (Master Warung)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stores (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_warung     TEXT        NOT NULL DEFAULT 'Warung Saya',
    -- Catatan: owner_user_id hanya untuk keperluan migrasi & audit,
    -- bukan dipakai untuk logika bisnis (gunakan store_members.role = 'owner')
    owner_user_id   TEXT        NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.stores IS 'Master data warung. Satu warung bisa punya banyak anggota (store_members).';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 2: TABEL STORE_MEMBERS (Keanggotaan Warung)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.store_members (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id     TEXT        NOT NULL,
    role        TEXT        NOT NULL DEFAULT 'kasir', -- 'owner' atau 'kasir'
    invited_by  TEXT,       -- user_id yang mengundang (null jika owner pertama)
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, user_id)
);

COMMENT ON TABLE public.store_members IS 'Relasi many-to-many antara user dan store. Satu user bisa menjadi anggota beberapa warung.';


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 2.5: HELPER FUNCTIONS (Harus dibuat setelah tabel ada)
-- ═══════════════════════════════════════════════════════════════

-- Fungsi untuk mendapatkan semua store_id yang dimiliki user aktif.
-- Menggunakan SECURITY DEFINER untuk menghindari infinite recursion
-- saat fungsi ini dipakai dalam RLS policy tabel store_members.
CREATE OR REPLACE FUNCTION public.get_my_store_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT store_id FROM public.store_members WHERE user_id = auth.uid()::text;
$$;

-- Fungsi untuk mencari user_id berdasarkan email.
-- Menggunakan SECURITY DEFINER untuk mengakses tabel auth.users
-- yang tidak bisa diakses langsung dari frontend.
-- Dipakai oleh fitur "Tambah Kasir by Email" di StoreSettings.
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT id::text FROM auth.users WHERE lower(email) = lower(lookup_email) LIMIT 1;
$$;


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 3: TAMBAH KOLOM store_id KE SEMUA TABEL DATA
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.transactions         ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.expenses             ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.debts                ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.receivables          ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.products             ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.shifts               ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.journal_entries      ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.cash_reconciliation  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.inbound_logs         ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers            ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 4: INDEX PERFORMA
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_stores_owner_user_id         ON public.stores(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_store_members_store_id       ON public.store_members(store_id);
CREATE INDEX IF NOT EXISTS idx_store_members_user_id        ON public.store_members(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_store_id        ON public.transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_store_id            ON public.expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_debts_store_id               ON public.debts(store_id);
CREATE INDEX IF NOT EXISTS idx_receivables_store_id         ON public.receivables(store_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id            ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_shifts_store_id              ON public.shifts(store_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_store_id     ON public.journal_entries(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_reconciliation_store_id ON public.cash_reconciliation(store_id);
CREATE INDEX IF NOT EXISTS idx_inbound_logs_store_id        ON public.inbound_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_store_id           ON public.suppliers(store_id);


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 5: MIGRASI DATA LAMA
-- Untuk setiap user_id unik yang ada di tabel-tabel data,
-- buat satu store otomatis dan assign store_id ke semua record
-- milik user tersebut. Tidak ada data yang hilang.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_user_id   TEXT;
    v_store_id  UUID;
BEGIN
    FOR v_user_id IN (
        SELECT DISTINCT uid FROM (
            SELECT user_id AS uid FROM public.transactions        WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.expenses            WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.debts               WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.receivables         WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.products            WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.shifts              WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.journal_entries     WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.cash_reconciliation WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.inbound_logs        WHERE user_id IS NOT NULL
            UNION
            SELECT user_id AS uid FROM public.suppliers           WHERE user_id IS NOT NULL
        ) all_users
    )
    LOOP
        -- Idempotent: skip jika store sudah dibuat untuk user ini
        SELECT sm.store_id INTO v_store_id
        FROM public.store_members sm
        WHERE sm.user_id = v_user_id
        LIMIT 1;

        IF v_store_id IS NULL THEN
            -- Buat store baru untuk user ini
            INSERT INTO public.stores (nama_warung, owner_user_id)
            VALUES ('Warung Saya', v_user_id)
            RETURNING id INTO v_store_id;

            -- Daftarkan user sebagai owner store tersebut
            INSERT INTO public.store_members (store_id, user_id, role)
            VALUES (v_store_id, v_user_id, 'owner');

            RAISE NOTICE 'Dibuat store baru % untuk user %', v_store_id, v_user_id;
        END IF;

        -- Assign store_id ke semua record milik user ini (yang belum punya store_id)
        UPDATE public.transactions        SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.expenses            SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.debts               SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.receivables         SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.products            SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.shifts              SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.journal_entries     SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.cash_reconciliation SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.inbound_logs        SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;
        UPDATE public.suppliers           SET store_id = v_store_id WHERE user_id = v_user_id AND store_id IS NULL;

        RAISE NOTICE 'Data lama untuk user % berhasil dimigrasi ke store %', v_user_id, v_store_id;
    END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 6: ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

-- ── 6a. RLS untuk tabel stores ───────────────────────────────
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_member_can_read_store" ON public.stores;
CREATE POLICY "store_member_can_read_store"
    ON public.stores FOR SELECT TO authenticated
    USING (id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "store_member_can_update_store" ON public.stores;
CREATE POLICY "store_member_can_update_store"
    ON public.stores FOR UPDATE TO authenticated
    USING (id IN (SELECT public.get_my_store_ids()))
    WITH CHECK (id IN (SELECT public.get_my_store_ids()));

-- Izinkan user terautentikasi membuat store baru (untuk user pertama kali)
DROP POLICY IF EXISTS "authenticated_can_create_store" ON public.stores;
CREATE POLICY "authenticated_can_create_store"
    ON public.stores FOR INSERT TO authenticated
    WITH CHECK (owner_user_id = auth.uid()::text);

-- ── 6b. RLS untuk tabel store_members ────────────────────────
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

-- Anggota bisa melihat semua anggota di store yang sama
DROP POLICY IF EXISTS "members_can_read_store_members" ON public.store_members;
CREATE POLICY "members_can_read_store_members"
    ON public.store_members FOR SELECT TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

-- Owner bisa menambahkan anggota baru ke store-nya
-- ATAU user bisa mendaftarkan diri sebagai owner store yang baru dibuat
DROP POLICY IF EXISTS "can_insert_store_members" ON public.store_members;
CREATE POLICY "can_insert_store_members"
    ON public.store_members FOR INSERT TO authenticated
    WITH CHECK (
        -- Owner menambahkan kasir ke store-nya
        store_id IN (
            SELECT sm.store_id FROM public.store_members sm
            WHERE sm.user_id = auth.uid()::text AND sm.role = 'owner'
        )
        -- ATAU user mendaftarkan diri ke store yang baru saja mereka buat
        OR (
            user_id = auth.uid()::text
            AND store_id IN (
                SELECT id FROM public.stores WHERE owner_user_id = auth.uid()::text
            )
        )
    );

-- Owner bisa menghapus anggota (kecuali diri sendiri)
DROP POLICY IF EXISTS "owners_can_delete_members" ON public.store_members;
CREATE POLICY "owners_can_delete_members"
    ON public.store_members FOR DELETE TO authenticated
    USING (
        store_id IN (
            SELECT sm.store_id FROM public.store_members sm
            WHERE sm.user_id = auth.uid()::text AND sm.role = 'owner'
        )
        AND user_id != auth.uid()::text
    );

-- ── 6c. Update RLS semua tabel data ke berbasis store_id ─────

-- Policy: transactions
DROP POLICY IF EXISTS "Allow authenticated full access on transactions" ON public.transactions;
CREATE POLICY "Allow authenticated full access on transactions"
    ON public.transactions FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: expenses
DROP POLICY IF EXISTS "Allow authenticated full access on expenses" ON public.expenses;
CREATE POLICY "Allow authenticated full access on expenses"
    ON public.expenses FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: debts
DROP POLICY IF EXISTS "Allow authenticated full access on debts" ON public.debts;
CREATE POLICY "Allow authenticated full access on debts"
    ON public.debts FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: receivables
DROP POLICY IF EXISTS "Allow authenticated full access on receivables" ON public.receivables;
CREATE POLICY "Allow authenticated full access on receivables"
    ON public.receivables FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: products
DROP POLICY IF EXISTS "Allow authenticated full access on products" ON public.products;
CREATE POLICY "Allow authenticated full access on products"
    ON public.products FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: shifts
DROP POLICY IF EXISTS "Allow authenticated full access on shifts" ON public.shifts;
CREATE POLICY "Allow authenticated full access on shifts"
    ON public.shifts FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: journal_entries
DROP POLICY IF EXISTS "Allow authenticated full access on journal_entries" ON public.journal_entries;
CREATE POLICY "Allow authenticated full access on journal_entries"
    ON public.journal_entries FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: cash_reconciliation
DROP POLICY IF EXISTS "Allow authenticated full access on cash_reconciliation" ON public.cash_reconciliation;
CREATE POLICY "Allow authenticated full access on cash_reconciliation"
    ON public.cash_reconciliation FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: inbound_logs
DROP POLICY IF EXISTS "Allow authenticated full access on inbound_logs" ON public.inbound_logs;
CREATE POLICY "Allow authenticated full access on inbound_logs"
    ON public.inbound_logs FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: suppliers
DROP POLICY IF EXISTS "Allow authenticated full access on suppliers" ON public.suppliers;
CREATE POLICY "Allow authenticated full access on suppliers"
    ON public.suppliers FOR ALL TO authenticated
    USING (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    )
    WITH CHECK (
        store_id IN (SELECT public.get_my_store_ids())
        OR store_id IS NULL
    );

-- Policy: settings (tidak diubah — konfigurasi global, tidak perlu isolasi store)
-- (policy lama yang USING(true) dipertahankan)


-- ═══════════════════════════════════════════════════════════════
-- BAGIAN 7: REGISTRASI KE PUBLIKASI REALTIME
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE
        public.stores,
        public.store_members;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Tabel stores/store_members mungkin sudah terdaftar: %', SQLERRM;
END;
$$;


-- ============================================================
-- SELESAI: Sistem store_id berhasil diterapkan.
-- Langkah selanjutnya (di sisi frontend):
--   1. Update db.js: tambah index store_id (Dexie v12)
--   2. Update useAuthStore.js: fetch/create store saat login
--   3. Update syncService.js: push & pull pakai store_id
-- ============================================================
