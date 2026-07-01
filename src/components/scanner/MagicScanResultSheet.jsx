import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wand2, X, Check, ChevronRight, ShoppingBag, ArrowDownLeft, PackagePlus } from 'lucide-react'
import { formatRupiah } from '../../lib/utils'

/**
 * MagicScanResultSheet
 *
 * Bottom Sheet yang menampilkan daftar produk yang diprediksi oleh AI
 * dari analisa gambar (Magic Scan). User memilih produk yang paling sesuai
 * atau membatalkan untuk kembali ke kamera.
 *
 * @param {Array}    results    - Array objek produk dari hasil fuzzy match Supabase
 * @param {string}   activeMode - Mode scan saat ini (untuk label tombol konfirmasi)
 * @param {function} onConfirm  - Callback dengan (product: object)
 * @param {function} onCancel   - Callback saat user membatalkan
 */
const MagicScanResultSheet = ({ results, activeMode, onConfirm, onCancel }) => {
  const isVisible = results && results.length > 0

  // Label tombol konfirmasi sesuai mode
  const confirmLabels = {
    PENJUALAN: { icon: ShoppingBag, text: 'Tambah ke Keranjang', color: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' },
    KULAKAN: { icon: ArrowDownLeft, text: 'Pilih untuk Restock', color: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30' },
    PRODUK_BARU: { icon: PackagePlus, text: 'Input sebagai Produk Baru', color: 'bg-violet-500 hover:bg-violet-600 shadow-violet-500/30' },
  }
  const confirmLabel = confirmLabels[activeMode] || confirmLabels.PENJUALAN

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Overlay */}
          <motion.div
            key="magic-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm z-10"
          />

          {/* Bottom Sheet */}
          <motion.div
            key="magic-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ maxHeight: '80vh' }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Magic Scan AI</p>
                  <h3 className="font-bold text-gray-900 text-base">Apakah salah satu ini?</h3>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtitle */}
            <div className="px-5 py-2 bg-violet-50 border-b border-violet-100">
              <p className="text-xs text-violet-600 font-medium">
                AI mengenali {results.length} produk yang mungkin sesuai. Pilih yang paling cocok.
              </p>
            </div>

            {/* Daftar Hasil Prediksi */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
              <div className="p-4 space-y-2">
                {results.map((product, index) => (
                  <motion.button
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onConfirm(product)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50 active:scale-[0.98] transition-all text-left group"
                  >
                    {/* Rank Badge */}
                    <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-gray-100 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
                      <span className="text-xs font-bold text-gray-500 group-hover:text-violet-600">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Info Produk */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{product.nama}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{product.kategori}</span>
                        <span className="text-xs font-bold text-emerald-600">{formatRupiah(product.harga_jual)}</span>
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 flex-shrink-0 transition-colors" />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Footer: Tidak ada yang cocok */}
            <div className="px-5 pb-10 pt-3 border-t border-gray-100">
              <button
                onClick={onCancel}
                className="w-full py-3 rounded-2xl text-gray-500 font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                Tidak ada yang cocok — Coba lagi
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default MagicScanResultSheet
