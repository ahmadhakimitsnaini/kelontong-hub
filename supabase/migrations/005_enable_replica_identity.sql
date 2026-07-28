-- ============================================================
-- Migrasi: Mengaktifkan REPLICA IDENTITY FULL pada Seluruh Tabel
-- Versi: 005
-- Tanggal: 2026-07-28
-- Deskripsi:
--   Secara default di PostgreSQL, publikasi Realtime hanya menyiarkan
--   event INSERT secara penuh. Ketika terjadi event UPDATE atau DELETE
--   (misal mengedit pengeluaran, melunasi hutang/piutang, atau tutup shift),
--   server Realtime tidak memancarkan data baris yang diperbarui tersebut
--   ke perangkat lain tanpa konfigurasi REPLICA IDENTITY FULL.
--   Script ini mengaktifkan siaran baris utuh untuk seluruh tabel
--   pembukuan dan inventaris agar sinkronisasi multi-device berjalan sempurna.
-- ============================================================

-- Tabel Inti & Pembukuan
ALTER TABLE public.products             REPLICA IDENTITY FULL;
ALTER TABLE public.transactions         REPLICA IDENTITY FULL;
ALTER TABLE public.shifts               REPLICA IDENTITY FULL;
ALTER TABLE public.settings             REPLICA IDENTITY FULL;
ALTER TABLE public.debts                REPLICA IDENTITY FULL;
ALTER TABLE public.receivables          REPLICA IDENTITY FULL;
ALTER TABLE public.cash_reconciliation  REPLICA IDENTITY FULL;
ALTER TABLE public.expenses             REPLICA IDENTITY FULL;
ALTER TABLE public.journal_entries      REPLICA IDENTITY FULL;
ALTER TABLE public.inbound_logs         REPLICA IDENTITY FULL;
ALTER TABLE public.suppliers            REPLICA IDENTITY FULL;

-- Menampilkan konfirmasi (opsional)
DO $$
BEGIN
    RAISE NOTICE 'Berhasil mengaktifkan REPLICA IDENTITY FULL untuk seluruh tabel sinkronisasi.';
END;
$$;
