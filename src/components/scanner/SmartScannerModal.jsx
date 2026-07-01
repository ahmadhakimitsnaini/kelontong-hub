import React from 'react'
import { AnimatePresence } from 'framer-motion'
import useScannerStore from '../../store/useScannerStore'
import ActionSelectorBottomSheet from './ActionSelectorBottomSheet'
import CameraEngine from './CameraEngine'

/**
 * SmartScannerModal — Komponen Induk (Gateway / Orchestrator)
 *
 * Bertanggung jawab untuk routing render:
 *  - isScannerOpen = false → Tidak render apa-apa
 *  - isScannerOpen = true && activeMode = null → Tampilkan ActionSelectorBottomSheet
 *  - isScannerOpen = true && activeMode = 'X' → Tampilkan CameraEngine (kamera aktif)
 *
 * PENTING: CameraEngine HANYA dirender saat activeMode terisi.
 * Ini memastikan kamera diinisialisasi setelah mode dipilih,
 * dan lifecycle cleanup (stop kamera) berjalan saat kembali ke mode selector.
 *
 * Komponen ini di-mount di tingkat root (App.jsx / AppLayout.jsx) agar
 * tersedia di seluruh halaman aplikasi.
 */
const SmartScannerModal = () => {
  const { isScannerOpen, activeMode } = useScannerStore()

  return (
    <>
      {/* Bottom Sheet Pilihan Mode — Selalu dirender saat isScannerOpen */}
      {/* CameraEngine sudah punya rendernya sendiri saat activeMode terisi */}
      <ActionSelectorBottomSheet />

      {/* Kamera Engine — Hanya aktif saat mode sudah dipilih */}
      <AnimatePresence mode="wait">
        {isScannerOpen && activeMode && (
          <CameraEngine key={activeMode} />
        )}
      </AnimatePresence>
    </>
  )
}

export default SmartScannerModal
