-- ============================================================
-- Migrasi: Menggabungkan (Merge) 2 Akun ke 1 Warung
-- Versi: 008
-- Tanggal: 2026-07-30
-- Deskripsi:
--   Script ini digunakan untuk menyatukan data warung milik akun 
--   'djamhurabufaatih@gmail.com' ke dalam warung utama milik 
--   'ahmadhakimitsnaini@gmail.com' tanpa menghilangkan data apapun.
-- ============================================================

DO $$
DECLARE
    -- Email yang akan diproses
    v_primary_email   TEXT := 'ahmadhakimitsnaini@gmail.com';
    v_secondary_email TEXT := 'djamhurabufaatih@gmail.com';
    
    -- ID User
    v_primary_user_id   TEXT;
    v_secondary_user_id TEXT;
    
    -- ID Warung (Store)
    v_primary_store_id   UUID;
    v_secondary_store_id UUID;
BEGIN
    -- 1. Ambil user_id berdasarkan email
    SELECT id::text INTO v_primary_user_id FROM auth.users WHERE email = v_primary_email;
    SELECT id::text INTO v_secondary_user_id FROM auth.users WHERE email = v_secondary_email;
    
    IF v_primary_user_id IS NULL OR v_secondary_user_id IS NULL THEN
        RAISE EXCEPTION 'ERROR: Salah satu atau kedua email tidak ditemukan di auth.users';
    END IF;

    -- 2. Cari store_id utama (Store A) milik akun primer
    SELECT store_id INTO v_primary_store_id
    FROM public.store_members
    WHERE user_id = v_primary_user_id AND role = 'owner'
    ORDER BY joined_at ASC
    LIMIT 1;

    -- 3. Cari store_id sekunder (Store B) milik akun sekunder
    SELECT store_id INTO v_secondary_store_id
    FROM public.store_members
    WHERE user_id = v_secondary_user_id AND role = 'owner'
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_primary_store_id IS NULL THEN
        RAISE EXCEPTION 'ERROR: Warung utama tidak ditemukan. Pastikan akun ahmadhakim sudah pernah login.';
    END IF;

    -- 4. Jika Store B ada dan berbeda dengan Store A, maka lakukan PENGGABUNGAN (Merge)
    IF v_secondary_store_id IS NOT NULL AND v_secondary_store_id != v_primary_store_id THEN
        
        RAISE NOTICE 'Memulai proses MERGE: Memindahkan data dari warung % ke warung %', v_secondary_store_id, v_primary_store_id;

        -- Pindahkan SEMUA data dari Store B ke Store A
        UPDATE public.transactions        SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.expenses            SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.debts               SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.receivables         SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.products            SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.shifts              SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.journal_entries     SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.cash_reconciliation SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.inbound_logs        SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;
        UPDATE public.suppliers           SET store_id = v_primary_store_id WHERE store_id = v_secondary_store_id;

        -- Hapus Store B secara permanen (otomatis menghapus keanggotaan Store B dari store_members karena CASCADE)
        DELETE FROM public.stores WHERE id = v_secondary_store_id;
        
        RAISE NOTICE 'Data berhasil digabungkan dan warung lama telah dihapus.';
    ELSE
        RAISE NOTICE 'Warung kedua tidak ditemukan atau sudah digabung. Melanjutkan untuk memastikan keanggotaan...';
    END IF;

    -- 5. Daftarkan akun kedua ke Warung Utama sebagai 'owner' (jika belum ada)
    IF NOT EXISTS (
        SELECT 1 FROM public.store_members 
        WHERE store_id = v_primary_store_id AND user_id = v_secondary_user_id
    ) THEN
        INSERT INTO public.store_members (store_id, user_id, role, invited_by)
        VALUES (v_primary_store_id, v_secondary_user_id, 'owner', v_primary_user_id);
        
        RAISE NOTICE 'Akun % berhasil ditambahkan sebagai OWNER di warung %', v_secondary_email, v_primary_store_id;
    ELSE
        -- Jika sudah terdaftar (misal sebelumnya diundang via UI), pastikan jabatannya 'owner'
        UPDATE public.store_members 
        SET role = 'owner'
        WHERE store_id = v_primary_store_id AND user_id = v_secondary_user_id AND role != 'owner';
        
        RAISE NOTICE 'Akun % sudah berada di warung utama.', v_secondary_email;
    END IF;

END;
$$;
