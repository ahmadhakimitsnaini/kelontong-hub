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

db.version(1).stores({
  /**
   * Tabel: products
   * Menyimpan katalog produk secara lokal agar kasir bisa beroperasi offline.
   *
   * Kolom yang diindeks (untuk query cepat):
   * - id          : Primary key (auto-increment)
   * - kategori    : Untuk filter Quick-Tap di halaman Kasir
   * - expiry_date : Untuk sorting dan alert FIFO Pintar
   * - stok        : Untuk notifikasi stok minimum
   */
  products: '++id, kategori, expiry_date, stok, nama',

  /**
   * Tabel: transactions
   * Menyimpan antrean transaksi sementara saat offline.
   * Setelah terkoneksi, akan di-sync ke Supabase.
   *
   * Kolom yang diindeks:
   * - id          : Primary key (auto-increment)
   * - shift_id    : Menghubungkan transaksi ke sesi shift tertentu
   * - timestamp   : Untuk laporan harian dan sorting
   * - synced      : Flag untuk menandai apakah sudah di-upload ke server (0 = belum, 1 = sudah)
   */
  transactions: '++id, shift_id, timestamp, synced',

  /**
   * Tabel: shifts
   * Menyimpan sesi kerja per shift (pergantian jaga).
   *
   * Kolom yang diindeks:
   * - id          : Primary key (auto-increment)
   * - user_id     : Siapa yang berjaga di shift ini
   * - start_time  : Waktu mulai shift
   * - end_time    : Waktu selesai shift
   * - synced      : Flag sinkronisasi
   */
  shifts: '++id, user_id, start_time, end_time, synced',

  /**
   * Tabel: expenses
   * Menyimpan catatan pengeluaran operasional harian.
   *
   * Kolom yang diindeks:
   * - id          : Primary key (auto-increment)
   * - shift_id    : Pengeluaran terkait shift aktif
   * - timestamp   : Waktu pencatatan
   * - synced      : Flag sinkronisasi
   */
  expenses: '++id, shift_id, timestamp, synced',
})

export default db
