import Dexie from 'dexie'

/**
 * MaduraDigital - Database Lokal (IndexedDB via Dexie.js)
 *
 * Database ini berfungsi sebagai lapisan penyimpanan OFFLINE.
 * Data akan disinkronisasi ke Supabase saat koneksi internet tersedia.
 *
 * Skema mengacu pada Data Model di PRD (Bagian V) beserta tambahan
 * kolom harga_beli untuk kalkulasi Laba/Rugi yang akurat.
 */
export const db = new Dexie('MaduraDigitalDB')

// ── VERSI 1: Skema Awal ──────────────────────────────────────────────────────
db.version(1).stores({
  products: '++id, kategori, expiry_date, stok, nama',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
})

// ── VERSI 2: Tambahan Tabel Modul Pembukuan ──────────────────────────────────
db.version(2).stores({
  /**
   * Tabel: products (tidak berubah)
   */
  products: '++id, kategori, expiry_date, stok, nama',

  /**
   * Tabel: transactions (tidak berubah)
   */
  transactions: '++id, shift_id, timestamp, synced',

  /**
   * Tabel: shifts (tidak berubah)
   */
  shifts: '++id, user_id, start_time, end_time, synced',

  /**
   * Tabel: expenses (tidak berubah)
   */
  expenses: '++id, shift_id, timestamp, synced',

  /**
   * Tabel: journal_entries (BARU)
   * Menyimpan semua entri jurnal Double-Entry Bookkeeping.
   * Di-generate otomatis oleh sistem saat transaksi/pengeluaran terjadi.
   *
   * Kolom yang diindeks:
   * - id           : Primary key (auto-increment)
   * - timestamp    : Untuk sorting kronologis di Buku Besar
   * - account_name : Nama akun (Kas, Penjualan, HPP, Beban Operasional, dll)
   * - type         : 'DEBIT' atau 'CREDIT'
   * - reference_id : ID referensi ke tabel asal (transaction.id / expense.id)
   * - reference_type : 'TRANSACTION' | 'EXPENSE' | 'DEBT_PAYMENT' | 'MANUAL'
   */
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',

  /**
   * Tabel: debts (BARU) — Hutang Supplier / Accounts Payable
   *
   * Kolom:
   * - id            : Primary key
   * - supplier_name : Nama supplier/agen
   * - description   : Keterangan barang yang dihutang
   * - amount        : Total tagihan awal
   * - paid_amount   : Total yang sudah dibayar
   * - due_date      : Tanggal jatuh tempo (timestamp)
   * - status        : 'UNPAID' | 'PARTIAL' | 'PAID'
   * - created_at    : Waktu pencatatan
   */
  debts: '++id, supplier_name, due_date, status, created_at',

  /**
   * Tabel: receivables (BARU) — Kasbon Pelanggan / Accounts Receivable
   *
   * Kolom:
   * - id             : Primary key
   * - customer_name  : Nama pelanggan
   * - customer_phone : No HP untuk kirim tagihan via WA (opsional)
   * - amount         : Total hutang yang belum dibayar
   * - credit_limit   : Batas maksimal kasbon (opsional)
   * - last_updated   : Waktu terakhir ada aktivitas
   * - status         : 'ACTIVE' | 'SETTLED'
   */
  receivables: '++id, customer_name, status, last_updated',

  /**
   * Tabel: cash_reconciliation (BARU) — Rekonsiliasi / Tutup Kasir
   *
   * Kolom:
   * - id               : Primary key
   * - timestamp        : Waktu tutup kasir
   * - shift_id         : Referensi ke sesi shift
   * - system_balance   : Total kas menurut sistem (dari transaksi Tunai)
   * - physical_balance : Uang fisik yang dihitung kasir
   * - difference       : Selisih (physical - system); negatif = kurang
   * - note             : Keterangan jika ada selisih
   */
  cash_reconciliation: '++id, timestamp, shift_id',
})

export default db
