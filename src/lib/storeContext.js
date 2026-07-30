/**
 * storeContext.js
 *
 * Singleton ringan untuk menyimpan storeId aktif secara global.
 *
 * Mengapa tidak langsung pakai useAuthStore?
 * → Menghindari circular import:
 *   db.js → useAuthStore.js → syncService.js → db.js (circular!)
 *
 * Dengan modul ini, rantai importnya menjadi:
 *   db.js        → storeContext.js (aman)
 *   syncService.js → storeContext.js (aman)
 *   useAuthStore.js → storeContext.js (aman, dia yang set nilainya)
 */

let _storeId = null;

/**
 * Set storeId aktif. Dipanggil dari useAuthStore setelah login berhasil.
 * @param {string|null} storeId - UUID toko aktif
 */
export const setActiveStoreId = (storeId) => {
  _storeId = storeId;
};

/**
 * Ambil storeId aktif. Dipakai oleh syncService dan db hook.
 * @returns {string|null}
 */
export const getActiveStoreId = () => _storeId;
