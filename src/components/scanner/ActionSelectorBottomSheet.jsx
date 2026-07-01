import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, ArrowUpRight, ArrowDownLeft, PackagePlus } from 'lucide-react'
import useScannerStore from '../../store/useScannerStore'

/**
 * ActionSelectorBottomSheet
 *
 * Bottom Sheet yang muncul saat user menekan tombol Scan.
 * Menampilkan pilihan mode scan:
 *   1. Toggle Mode Auto-Scan (persisted preference)
 *   2. Scan Penjualan (Kasir)
 *   3. Scan Kulakan (Restock)
 *   4. Scan Produk Baru
 */
const ActionSelectorBottomSheet = () => {
  const { isScannerOpen, isAutoScan, toggleAutoScan, setActiveMode, closeScanner } = useScannerStore()

  const handleSelectMode = (mode) => {
    setActiveMode(mode)
  }

  const modeOptions = [
    {
      id: 'PENJUALAN',
      icon: ArrowUpRight,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-200',
      hoverBg: 'hover:bg-emerald-50',
      activeBg: 'active:bg-emerald-100',
      title: 'Scan Penjualan (Kasir)',
      desc: 'Scan barang yang dibeli oleh pelanggan',
    },
    {
      id: 'KULAKAN',
      icon: ArrowDownLeft,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      hoverBg: 'hover:bg-blue-50',
      activeBg: 'active:bg-blue-100',
      title: 'Scan Kulakan',
      desc: 'Scan barang saat kamu belanja stok / restock',
    },
    {
      id: 'PRODUK_BARU',
      icon: PackagePlus,
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      borderColor: 'border-violet-200',
      hoverBg: 'hover:bg-violet-50',
      activeBg: 'active:bg-violet-100',
      title: 'Scan Produk Baru',
      desc: 'Input produk yang belum ada di database',
    },
  ]

  return (
    <AnimatePresence>
      {isScannerOpen && (
        <>
          {/* Overlay Gelap */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70]"
            onClick={closeScanner}
          />

          {/* Bottom Sheet Panel */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[80] bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ maxHeight: '92vh' }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Pilih Tindakan</h2>
                <p className="text-xs text-gray-400 mt-0.5">Pilih mode pemindaian yang sesuai</p>
              </div>
              <button
                id="scanner-close-btn"
                onClick={closeScanner}
                className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten */}
            <div className="px-5 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 100px)' }}>

              {/* ── Opsi 1: Toggle Auto-Scan ────────────────────────────────── */}
              <div className="border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
                {/* Ikon */}
                <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>

                {/* Teks */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">Mode Auto-Scan</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Kamera otomatis mendeteksi & memproses barang
                  </p>
                </div>

                {/* Toggle Switch */}
                <button
                  id="auto-scan-toggle"
                  onClick={toggleAutoScan}
                  role="switch"
                  aria-checked={isAutoScan}
                  className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isAutoScan
                      ? 'bg-amber-400 focus:ring-amber-400'
                      : 'bg-gray-200 focus:ring-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                      isAutoScan ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* ── Opsi 2–4: Mode Tombol ───────────────────────────────────── */}
              {modeOptions.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    id={`scan-mode-${opt.id.toLowerCase()}`}
                    onClick={() => handleSelectMode(opt.id)}
                    className={`w-full border ${opt.borderColor} rounded-2xl p-4 flex items-center gap-4 text-left transition-all duration-150 ${opt.hoverBg} ${opt.activeBg} active:scale-[0.98]`}
                  >
                    {/* Ikon */}
                    <div className={`w-11 h-11 flex-shrink-0 rounded-xl ${opt.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${opt.iconColor}`} />
                    </div>

                    {/* Teks */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{opt.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                    </div>

                    {/* Chevron */}
                    <svg
                      className={`w-5 h-5 flex-shrink-0 ${opt.iconColor}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )
              })}

              {/* Safe-area spacer untuk perangkat dengan home indicator */}
              <div className="h-4" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ActionSelectorBottomSheet
