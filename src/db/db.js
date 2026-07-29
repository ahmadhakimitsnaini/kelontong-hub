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

// ── VERSI 7: Persetujuan Inbound (Approval Workflow) ─────────────────────────
db.version(7).stores({
  products: '++id, kategori, expiry_date, nama, barcode, stok',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
  inbound_logs: '++id, timestamp, kasir_nama, status, synced'
});

// ── VERSI 8: Pengaturan (Settings) untuk Jam Malam ───────────────────────────
db.version(8).stores({
  products: '++id, kategori, expiry_date, nama, barcode, stok',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
  inbound_logs: '++id, timestamp, kasir_nama, status, synced',
  settings: 'key, synced'
});

// ── VERSI 9: Tabel untuk menyimpan ID yang dihapus agar tersinkronisasi ─────
db.version(9).stores({
  products: '++id, kategori, expiry_date, nama, barcode, stok',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
  inbound_logs: '++id, timestamp, kasir_nama, status, synced',
  settings: 'key, synced',
  pending_deletions: '++id, tableName, recordId'
});

// ── VERSI 10: Master Supplier & Pemetaan Produk per Supplier ─────────────────
// Penambahan tabel 'suppliers' sebagai master data terpusat pengganti free-text.
// Index 'supplier_id' ditambahkan pada products, inbound_logs, dan debts
// agar query filter/group-by per supplier berlangsung secara instan (< 50ms).
// Catatan: 'debts' mempertahankan index 'supplier_name' untuk backward
// compatibility dengan data hutang lama yang belum terhubung ke supplier master.
db.version(10).stores({
  products: '++id, kategori, expiry_date, nama, barcode, stok, supplier_id',
  transactions: '++id, shift_id, timestamp, synced',
  shifts: '++id, user_id, start_time, end_time, synced',
  expenses: '++id, shift_id, timestamp, synced',
  journal_entries: '++id, timestamp, account_name, type, reference_id, reference_type',
  debts: '++id, supplier_id, supplier_name, due_date, status, created_at',
  receivables: '++id, customer_name, status, last_updated',
  cash_reconciliation: '++id, timestamp, shift_id',
  inbound_logs: '++id, timestamp, supplier_id, kasir_nama, status, synced',
  settings: 'key, synced',
  pending_deletions: '++id, tableName, recordId',
  suppliers: '++id, nama_supplier, kontak_phone, synced',
});

// ── VERSI 11: Tambah Index user_id untuk Isolasi Data per Akun ───────────────
// Kolom 'user_id' ditambahkan ke seluruh tabel syncable agar:
// 1. Query filter WHERE user_id = 'xxx' berjalan O(log n), bukan O(n) full scan.
// 2. Data yang di-pull dari Supabase (yang sudah difilter per user_id) bisa
//    diidentifikasi dan dikelola secara lokal per akun.
// Tidak ada upgrade() karena hanya penambahan index — data yang sudah ada
// tidak perlu dimodifikasi (kolom user_id akan bernilai undefined/null
// untuk record lama, dan diisi untuk record baru).
db.version(11).stores({
  products:             '++id, kategori, expiry_date, nama, barcode, stok, supplier_id, user_id',
  transactions:         '++id, shift_id, timestamp, synced, user_id',
  shifts:               '++id, user_id, start_time, end_time, synced',
  expenses:             '++id, shift_id, timestamp, synced, user_id',
  journal_entries:      '++id, timestamp, account_name, type, reference_id, reference_type, user_id',
  debts:                '++id, supplier_id, supplier_name, due_date, status, created_at, user_id',
  receivables:          '++id, customer_name, status, last_updated, user_id',
  cash_reconciliation:  '++id, timestamp, shift_id, user_id',
  inbound_logs:         '++id, timestamp, supplier_id, kasir_nama, status, synced, user_id',
  settings:             'key, synced',
  pending_deletions:    '++id, tableName, recordId',
  suppliers:            '++id, nama_supplier, kontak_phone, synced, user_id',
});

// ── HOOKS ────────────────────────────────────────────────────────────────────
// Daftar semua tabel yang akan disinkronkan ke Cloud
const syncableTables = ['products', 'transactions', 'shifts', 'expenses', 'journal_entries', 'debts', 'receivables', 'cash_reconciliation', 'inbound_logs', 'settings', 'suppliers'];

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16));
};

syncableTables.forEach(tableName => {
  // HOOK KETIKA INSERT (DATA BARU)
  db[tableName].hook('creating', function (primKey, obj, transaction) {
    // Beri flag synced = 0
    if (typeof obj.synced === 'undefined') {
      obj.synced = 0;
    }
    // Paksa ID menggunakan UUID agar tidak tabrakan antar HP
    if (!primKey || typeof primKey === 'number') {
      const uuid = generateUUID();
      obj.id = uuid;
      // Pancarkan sinyal bahwa ada data baru ditulis ke lokal
      setTimeout(() => window.dispatchEvent(new Event('idbWrite')), 0);
      return uuid;
    }
    // Pancarkan sinyal bahwa ada data baru ditulis ke lokal
    // Ditangkap AppLayout untuk langsung memicu PUSH ke Supabase
    setTimeout(() => window.dispatchEvent(new Event('idbWrite')), 0);
  });

  // HOOK KETIKA UPDATE (DATA DIUBAH SEPERTI HARGA/STOK)
  db[tableName].hook('updating', function (modifications, primKey, obj, transaction) {
    // Jika perubahan BUKAN berasal dari proses tarikan Cloud (yang mengeset synced: 1)
    // Maka kembalikan status synced menjadi 0 agar dikirim ulang ke Cloud
    if (modifications.synced !== 1) {
      // Pancarkan sinyal bahwa ada data diubah — AppLayout akan langsung PUSH
      setTimeout(() => window.dispatchEvent(new Event('idbWrite')), 0);
      return { synced: 0 };
    }
  });
});

export const deleteAndSync = async (tableName, id) => {
  await db[tableName].delete(id);
  if (db.pending_deletions) {
    await db.pending_deletions.add({ tableName, recordId: id });
    setTimeout(() => window.dispatchEvent(new Event('idbWrite')), 0);
  }
};

export default db
