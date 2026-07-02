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
  products: '++id, kategori, expiry_date, stok, nama',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
})

// ── VERSI 3: Pemisahan Stok (Gudang & Etalase) ───────────────────────────────
db.version(3).stores({
  // Tabel produk diupdate index-nya.
  // Kolom stok dihilangkan dari skema utama diganti dengan stok_gudang & stok_etalase
  // Catatan: Dexie hanya mengindeks kolom pencarian. Kolom data bebas ditambahkan.
  products: '++id, kategori, expiry_date, nama',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
}).upgrade(tx => {
  // Migrasi data: stok yang lama dialihkan ke stok_etalase, gudang diisi 0.
  return tx.products.toCollection().modify(product => {
    product.stok_etalase = product.stok !== undefined ? product.stok : 0;
    product.stok_gudang = 0;
    delete product.stok;
  });
});

// ── VERSI 4: Tambah Index Barcode pada Products ───────────────────────────────
// Field 'barcode' diindeks agar pencarian via scanner (WHERE barcode = X) sangat cepat.
// Kolom barcode bersifat opsional (bisa null untuk produk lama tanpa barcode).
db.version(4).stores({
  products: '++id, kategori, expiry_date, nama, barcode',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
});

// ── VERSI 5: Penyatuan Stok (Gudang & Etalase Dihapus) ────────────────────────
// Stok gudang dan etalase digabung kembali menjadi 'stok' tunggal.
db.version(5).stores({
  products: '++id, kategori, expiry_date, nama, barcode, stok',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
}).upgrade(tx => {
  return tx.products.toCollection().modify(product => {
    const etalase = product.stok_etalase !== undefined ? product.stok_etalase : 0;
    const gudang = product.stok_gudang !== undefined ? product.stok_gudang : 0;
    product.stok = etalase + gudang;
    delete product.stok_etalase;
    delete product.stok_gudang;
  });
});

// ── VERSI 6: Tabel Riwayat Inbound (Inbound Logs) ──────────────────────────────
db.version(6).stores({
  products: '++id, kategori, expiry_date, nama, barcode, stok',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
  inbound_logs: '++id, timestamp, kasir_nama, synced'
});

// ── HOOKS ────────────────────────────────────────────────────────────────────
// Secara otomatis set synced = 0 setiap ada insert baru ke tabel yang butuh disinkronkan
const syncableTables = ['transactions', 'shifts', 'expenses', 'journal_entries', 'debts', 'receivables', 'cash_reconciliation', 'inbound_logs'];

syncableTables.forEach(tableName => {
  db[tableName].hook('creating', function (primKey, obj, transaction) {
    if (typeof obj.synced === 'undefined') {
      obj.synced = 0;
    }
  });
});

export default db
