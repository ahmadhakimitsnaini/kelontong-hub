import db from '../db/db'
import { supabase } from './supabase'
import useAuthStore from '../store/useAuthStore'

const syncableTables = ['transactions', 'shifts', 'expenses', 'journal_entries', 'debts', 'receivables', 'cash_reconciliation'];

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

      // Hapus ID lokal (Dexie auto-increment) agar Supabase men-generate ID baru 
      // (Bisa UUID atau auto-increment milik server) untuk mencegah bentrok ID antar perangkat.
      const payload = unsyncedRecords.map(record => {
        const { id, synced, ...rest } = record;
        return rest;
      });

      // Kirim data ke Supabase
      const { error } = await supabase
        .from(tableName)
        .insert(payload);

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
