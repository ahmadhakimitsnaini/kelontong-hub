import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * MaduraDigital - Scanner State Management (Zustand)
 *
 * Store ini mengelola:
 * 1. Preferensi isAutoScan (persisted ke localStorage)
 * 2. Mode scan aktif (PENJUALAN | KULAKAN | PRODUK_BARU)
 * 3. Visibilitas modal scanner
 *
 * Mode lifecycle:
 *  - User klik tombol Scan → isScannerOpen = true, activeMode = null
 *  - User pilih mode → activeMode terisi, kamera menyala
 *  - User tutup / scan selesai → reset ke null
 */
export const useScannerStore = create(
  persist(
    (set) => ({
      // ── State ──────────────────────────────────────────────────────────────

      /** Apakah modal scanner (Bottom Sheet pilihan mode) sedang terbuka */
      isScannerOpen: false,

      /**
       * Mode scan yang sedang aktif.
       * null = belum memilih mode (Bottom Sheet tampil)
       * 'PENJUALAN' = Scan Penjualan (Kasir)
       * 'KULAKAN'   = Scan Kulakan (Restock Inbound)
       * 'PRODUK_BARU' = Scan Produk Baru
       */
      activeMode: null,

      /**
       * Preferensi Auto-Scan.
       * true  = kamera scan otomatis terus-menerus (debounced 2 detik)
       * false = user harus tekan tombol Capture manual
       * Disimpan ke localStorage via persist middleware.
       */
      isAutoScan: true,

      // ── Actions ────────────────────────────────────────────────────────────

      /** Buka Bottom Sheet pilihan mode scanner */
      openScanner: () => set({ isScannerOpen: true, activeMode: null }),

      /** Tutup seluruh modal scanner & reset state */
      closeScanner: () => set({ isScannerOpen: false, activeMode: null }),

      /**
       * Atur mode scan aktif. Setelah ini kamera akan menyala.
       * @param {'PENJUALAN'|'KULAKAN'|'PRODUK_BARU'} mode
       */
      setActiveMode: (mode) => set({ activeMode: mode }),

      /**
       * Kembali ke Bottom Sheet pilihan mode (tanpa menutup modal)
       * Berguna jika user ingin ganti mode tanpa menutup seluruh scanner
       */
      backToModeSelector: () => set({ activeMode: null }),

      /** Toggle preferensi Auto-Scan (persisted) */
      toggleAutoScan: () => set((state) => ({ isAutoScan: !state.isAutoScan })),
    }),
    {
      name: 'scanner-preferences', // Key di localStorage
      // Hanya persist preferensi isAutoScan, bukan state sementara
      partialize: (state) => ({ isAutoScan: state.isAutoScan }),
    }
  )
)

export default useScannerStore
