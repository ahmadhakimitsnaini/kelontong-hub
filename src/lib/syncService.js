import db from '../db/db'
import { supabase } from './supabase'

const syncableTables = ['products', 'transactions', 'shifts', 'expenses', 'journal_entries', 'debts', 'receivables', 'cash_reconciliation', 'inbound_logs'];

/**
 * Mensinkronisasi semua data yang tertunda ke Supabase.
 */
export const syncAllPendingData = async () => {
  if (!navigator.onLine) {
    console.log('[Sync] Offline, sinkronisasi dibatalkan.');
    return;
  }

  let totalSynced = 0;

  for (const tableName of syncableTables) {
    try {
      if (!db[tableName]) continue;

      // Mengambil semua record, filter secara manual untuk menangkap
      // record dengan synced = 0, atau synced = undefined (data lama).
      const allRecords = await db[tableName].toArray();
      const unsyncedRecords = allRecords.filter(r => r.synced === 0 || r.synced === undefined);

      if (unsyncedRecords.length === 0) continue;

      console.log(`[Sync] Menemukan ${unsyncedRecords.length} data tertunda di tabel ${tableName}`);

      // Persiapkan data untuk dikirim ke Supabase
      const payload = unsyncedRecords.map(record => {
        // Hapus property 'synced' karena itu hanya metadata lokal
        // KITA PERTAHANKAN 'id' (UUID) AGAR TIDAK DUPLIKASI
        const { synced, ...rest } = record;
        return rest;
      });

      // Gunakan UPSERT: 
      // Jika ID sudah ada di awan, timpa datanya (Update). 
      // Jika ID belum ada, tambahkan baru (Insert).
      const { error } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error(`[Sync] Error saat insert ke Supabase tabel ${tableName}:`, error.message || error);
        continue; 
      }

      // Jika berhasil di-cloud, update status lokal
      const idsToUpdate = unsyncedRecords.map(r => r.id);
      await db.transaction('rw', db[tableName], async () => {
        for (const localId of idsToUpdate) {
          await db[tableName].update(localId, { synced: 1 });
        }
      });
      
      totalSynced += unsyncedRecords.length;

    } catch (err) {
      console.error(`[Sync] Kesalahan tak terduga pada tabel ${tableName}:`, err);
    }
  }

  if (totalSynced > 0) {
    console.log(`[Sync] Berhasil mensinkronisasi ${totalSynced} baris data ke cloud.`);
    // Trigger sebuah custom event agar UI bisa tahu kalau proses sync telah selesai
    window.dispatchEvent(new Event('syncCompleted'));
  }
};

/**
 * Menghitung jumlah record yang belum tersinkronisasi
 */
export const getPendingSyncCount = async () => {
  let count = 0;
  for (const tableName of syncableTables) {
    if (!db[tableName]) continue;
    const allRecords = await db[tableName].toArray();
    const unsynced = allRecords.filter(r => r.synced === 0 || r.synced === undefined);
    count += unsynced.length;
  }
  return count;
};

/**
 * Menarik (Pull) semua data dari Supabase ke IndexedDB Lokal.
 * Sangat berguna saat user pertama kali login di perangkat baru.
 */
export const pullFromSupabase = async () => {
  if (!navigator.onLine) {
    console.log('[Sync Pull] Offline, batal menarik data.');
    return;
  }

  console.log('[Sync Pull] Memulai penarikan data dari Supabase...');

  for (const tableName of syncableTables) {
    try {
      if (!db[tableName]) continue;

      // Ambil seluruh data dari tabel Supabase
      const { data, error } = await supabase.from(tableName).select('*');

      if (error) {
        console.error(`[Sync Pull] Gagal mengambil data tabel ${tableName}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        // Hapus data lokal dan timpa dengan data dari Cloud (Source of Truth)
        // Kita tambahkan flag synced: 1 agar tidak di-push balik ke cloud
        const recordsToInsert = data.map(item => ({ ...item, synced: 1 }));
        
        await db.transaction('rw', db[tableName], async () => {
          // Bersihkan tabel lokal agar tidak ada duplikasi ID
          await db[tableName].clear();
          // Masukkan data dari cloud
          await db[tableName].bulkAdd(recordsToInsert);
        });

        console.log(`[Sync Pull] Berhasil menarik ${data.length} baris untuk tabel ${tableName}`);
      }
    } catch (err) {
      console.error(`[Sync Pull] Kesalahan memproses tabel ${tableName}:`, err);
    }
  }

  console.log('[Sync Pull] Proses selesai.');
  window.dispatchEvent(new Event('syncCompleted'));
};

/**
 * Berlangganan (Subscribe) ke event Realtime Supabase (WebSocket).
 * Jika ada perangkat lain yang melakukan perubahan (Insert/Update/Delete),
 * perangkat ini akan langsung menerima datanya secara instan tanpa perlu refresh.
 */
let realtimeChannel = null;

export const subscribeToRealtime = () => {
  if (realtimeChannel) return; // Cegah double subscription

  console.log('[Sync Realtime] Menghubungkan ke WebSocket Supabase...');

  realtimeChannel = supabase
    .channel('public-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      async (payload) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        
        // Pastikan tabel yang berubah adalah tabel yang kita pantau
        if (syncableTables.includes(table)) {
          console.log(`[Sync Realtime] Menerima ${eventType} dari tabel ${table}`, payload);
          
          try {
            await db.transaction('rw', db[table], async () => {
              if (eventType === 'INSERT' || eventType === 'UPDATE') {
                // Simpan/Timpa ke IndexedDB lokal dengan flag synced: 1
                await db[table].put({ ...newRecord, synced: 1 });
              } else if (eventType === 'DELETE') {
                // Hapus dari IndexedDB lokal
                await db[table].delete(oldRecord.id);
              }
            });
            // Beri tahu UI bahwa ada data baru agar di-render ulang
            window.dispatchEvent(new Event('syncCompleted'));
          } catch (err) {
            console.error(`[Sync Realtime] Gagal memproses event ${eventType}:`, err);
          }
        }
      }
    )
    .subscribe((status) => {
      console.log('[Sync Realtime] Status Koneksi WebSocket:', status);
    });
};

export const unsubscribeRealtime = () => {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    console.log('[Sync Realtime] WebSocket diputuskan.');
  }
};
