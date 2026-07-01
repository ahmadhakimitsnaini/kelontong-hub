import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, X, Plus, Minus, Check } from 'lucide-react'
import { formatRupiah } from '../../lib/utils'

/**
 * KulakanQtyModal
 *
 * Modal yang muncul di atas layar kamera saat mode KULAKAN mendeteksi barcode.
 * User memasukkan jumlah barang yang dibeli (qty) untuk di-update ke stok gudang.
 *
 * @param {object}   product    - Objek produk yang ditemukan dari database
 * @param {function} onConfirm  - Callback dengan (qty: number)
 * @param {function} onCancel   - Callback saat user membatalkan
 */
const KulakanQtyModal = ({ product, onConfirm, onCancel }) => {
  const [qty, setQty] = useState(1)

  // Reset qty setiap kali produk berubah (scan produk baru)
  useEffect(() => {
    if (product) setQty(1)
  }, [product])

  const handleIncrement = () => setQty((q) => q + 1)
  const handleDecrement = () => setQty((q) => Math.max(1, q - 1))
  const handleInputChange = (e) => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val >= 1) setQty(val)
  }

  const handleConfirm = () => {
    if (qty >= 1) onConfirm(qty)
  }

  return (
    <AnimatePresence>
      {product && (
        <>
          {/* Overlay semi-transparan di atas kamera */}
          <motion.div
            key="kulakan-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10"
          />

          {/* Bottom Sheet di atas kamera */}
          <motion.div
            key="kulakan-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Scan Kulakan</p>
                  <h3 className="font-bold text-gray-900 text-base leading-tight">{product.nama}</h3>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Produk */}
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Stok Gudang Saat Ini</p>
                <p className="font-bold text-blue-700 text-lg">{product.stok_gudang || 0} pcs</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Harga Beli</p>
                <p className="font-bold text-gray-700">{formatRupiah(product.harga_beli)}</p>
              </div>
            </div>

            {/* Input Qty */}
            <div className="px-5 py-6">
              <p className="text-sm font-semibold text-gray-700 mb-4 text-center">
                Berapa jumlah barang yang masuk?
              </p>

              {/* Stepper */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleDecrement}
                  className="w-14 h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Minus className="w-6 h-6 text-gray-600" />
                </button>

                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={handleInputChange}
                  className="w-24 text-center text-3xl font-bold text-gray-900 border-2 border-gray-200 rounded-2xl py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                />

                <button
                  onClick={handleIncrement}
                  className="w-14 h-14 rounded-2xl bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-blue-500/30"
                >
                  <Plus className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Preview Stok Setelah Ditambah */}
              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500">Stok gudang setelah masuk:</span>
                <span className="font-bold text-blue-600 text-lg">
                  {(product.stok_gudang || 0) + qty} pcs
                </span>
              </div>
            </div>

            {/* Tombol Konfirmasi */}
            <div className="px-5 pb-10 pt-2">
              <button
                onClick={handleConfirm}
                className="w-full py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Tambah {qty} pcs ke Stok Gudang
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default KulakanQtyModal
