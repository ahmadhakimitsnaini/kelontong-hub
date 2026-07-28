import db from '../db/db'
import { supabase } from './supabase'

const syncableTables = ['products', 'transactions', 'shifts', 'expenses', 'journal_entries', 'debts', 'receivables', 'cash_reconciliation', 'inbound_logs', 'settings', 'suppliers'];

/**
 * Mensinkronisasi semua data yang tertunda ke Supabase.
 */
export const syncAllPendingData = async () => {
  if (!navigator.onLine) {
    console.log('[Sync] Offline, sinkronisasi dibatalkan.');
    return;
  }

  let totalSynced = 0;

  // 1. PROSES PENDING DELETIONS
  if (db.pending_deletions) {
    try {
      const deletions = await db.pending_deletions.toArray();
      if (deletions.length > 0) {
        console.log(`[Sync] Menemukan ${deletions.length} data untuk dihapus di cloud`);
        for (const del of deletions) {
          const pk = del.tableName === 'settings' ? 'key' : 'id';
          const { error } = await supabase.from(del.tableName).delete().eq(pk, del.recordId);
          if (error) {
            console.error(`[Sync] Error hapus ${del.recordId} di tabel ${del.tableName}:`, error);
          } else {
            await db.pending_deletions.delete(del.id);
            totalSynced++;
          }
        }
      }
    } catch (err) {
      console.error(`[Sync] Error proses pending_deletions:`, err);
    }
  }

  // 2. PROSES PENDING UPSERTS
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
      const primaryKey = tableName === 'settings' ? 'key' : 'id';
      const { error } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: primaryKey });

      if (error) {
        console.error(`[Sync] Error saat insert ke Supabase tabel ${tableName}:`, error.message || error);
        continue; 
      }

      // Jika berhasil di-cloud, update status lokal
      const idsToUpdate = unsyncedRecords.map(r => tableName === 'settings' ? r.key : r.id);
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
 * Menghapus SEMUA data dari seluruh tabel lokal IndexedDB.
 *
 * Dipanggil saat event logout() untuk mencegah kebocoran data
 * antar akun (cross-account data contamination) pada perangkat yang sama.
 * Tanpa ini, data Akun A akan terlihat oleh Akun B yang login berikutnya.
 */
export const clearAllLocalData = async () => {
  console.log('[Sync] Membersihkan seluruh data lokal IndexedDB...');
  for (const tableName of syncableTables) {
    try {
      if (!db[tableName]) continue;
      await db[tableName].clear();
    } catch (err) {
      console.error(`[Sync] Gagal membersihkan tabel lokal '${tableName}':`, err);
    }
  }
  // Bersihkan juga tabel non-syncable yang mungkin ada data lintas akun
  if (db.pending_deletions) {
    try { await db.pending_deletions.clear(); } catch (err) { /* abaikan */ }
  }
  console.log('[Sync] Pembersihan IndexedDB selesai.');
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

      if (!error && data !== null) {
        // Tambahkan flag synced: 1 agar data cloud tidak di-push balik ke server
        const recordsToInsert = data.map(item => ({ ...item, synced: 1 }));

        await db.transaction('rw', db[tableName], async () => {
          // 1. Ambil & pertahankan record lokal yang MASIH PENDING (synced === 0)
          const allLocal = await db[tableName].toArray();
          const pendingLocalRecords = allLocal.filter(r => r.synced === 0 || r.synced === undefined);

          // 2. Bersihkan dulu — Cloud adalah Source of Truth untuk data tersinkron
          await db[tableName].clear();

          // 3. Masukkan data dari cloud (jika ada)
          if (recordsToInsert.length > 0) {
            await db[tableName].bulkAdd(recordsToInsert);
          }

          // 4. Masukkan kembali record lokal yang masih pending agar tidak hilang!
          if (pendingLocalRecords.length > 0) {
            await db[tableName].bulkPut(pendingLocalRecords);
            console.log(`[Sync Pull] Mempertahankan ${pendingLocalRecords.length} record lokal tertunda (synced: 0) di tabel '${tableName}'`);
          }
        });

        console.log(`[Sync Pull] Tabel '${tableName}': lokal disinkronkan, ${data.length} baris dimuat dari cloud.`);
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
let reconnectTimer = null;

export const subscribeToRealtime = () => {
  // Jika channel lama sudah ada, bersihkan dulu agar bisa menggunakan token JWT terbaru
  if (realtimeChannel) {
    console.log('[Sync Realtime] Mereset saluran WebSocket lama...');
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  clearTimeout(reconnectTimer);

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
                const pk = table === 'settings' ? oldRecord.key : oldRecord.id;
                await db[table].delete(pk);
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
      // AUTO-RECONNECT: Jika koneksi terputus atau error, coba hubungkan kembali setelah 3 detik
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Sync Realtime] WebSocket terputus. Mencoba menghubungkan kembali dalam 3 detik...');
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
        reconnectTimer = setTimeout(() => {
          if (navigator.onLine) subscribeToRealtime();
        }, 3000);
      }
    });
};

export const unsubscribeRealtime = () => {
  clearTimeout(reconnectTimer);
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    console.log('[Sync Realtime] WebSocket diputuskan.');
  }
};
