import React, { useState, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingBag, X, CheckCircle, CreditCard, Banknote, Wallet, Moon } from 'lucide-react'
import useCartStore from '../../store/useCartStore'
import { formatRupiah, formatRibuan, checkIsNightTime, getEffectivePrice } from '../../lib/utils'
import db from '../../db/db'
import useNotificationStore from '../../store/useNotificationStore'
import useHardwareScanner from '../../hooks/useHardwareScanner'
import { playSuccessBeep, playErrorBeep } from '../../lib/audioUtils'
import useSettingsStore from '../../store/useSettingsStore'
import useAuthStore from '../../store/useAuthStore'
import ReceiptModal from '../../components/ui/ReceiptModal'
import PaymentModal from './PaymentModal'

import { useLiveQuery } from 'dexie-react-hooks'

const POSPage = () => {
  // Global State (Zustand)
  const cartItems = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const removeOneItem = useCartStore((state) => state.removeOneItem)
  const deleteItem = useCartStore((state) => state.deleteItem)
  const clearCart = useCartStore((state) => state.clearCart)
  const totalHarga = useCartStore((state) => state.getTotal())
  const totalBarang = useCartStore((state) => state.getTotalItems())

  // Ambil user yang sedang login untuk keperluan user_id pada transaksi
  const { user } = useAuthStore()

  // Local State
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState(null)

  // Night Pricing Settings
  const { isNightPricingActive, nightStartTime, nightEndTime, fetchSettings } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Evaluasi jam secara real-time saat render
  const isNightTimeNow = isNightPricingActive && checkIsNightTime(nightStartTime, nightEndTime);

  // ==========================================
  // HARDWARE SCANNER INTEGRATION
  // ==========================================
  useHardwareScanner(async (barcode) => {
    try {
      const product = await db.products.where('barcode').equals(barcode).first();
      if (product) {
        const storeState = useSettingsStore.getState();
        const scanNightTime = storeState.isNightPricingActive && checkIsNightTime(storeState.nightStartTime, storeState.nightEndTime);
        const effectivePrice = getEffectivePrice(product, scanNightTime);
        
        const added = addItem(product, effectivePrice);
        if (added) {
          playSuccessBeep();
          // Optional: Tampilkan notifikasi pendek
          useNotificationStore.getState().showAlert(`+1 ${product.nama}`, "success");
        } else {
          playErrorBeep();
        }
      } else {
        playErrorBeep();
        useNotificationStore.getState().showAlert(`Barcode ${barcode} tidak ditemukan!`, "error");
      }
    } catch (err) {
      console.error('Error saat men-scan barcode:', err);
    }
  }, { enabled: !isPaymentModalOpen }); // Nonaktifkan scanner saat modal pembayaran terbuka
  // ==========================================

  // Ambil data produk asli dari database
  const dbProducts = useLiveQuery(() => db.products.toArray(), []) || []

  // Ekstrak daftar kategori unik dari data produk (Mencegah duplikat akibat spasi/huruf besar)
  const categorySet = new Set()
  const categories = ['Semua']
  
  dbProducts.forEach(p => {
    if (p.kategori) {
      const normalized = p.kategori.trim().toLowerCase()
      if (!categorySet.has(normalized)) {
        categorySet.add(normalized)
        // Gunakan versi trim untuk UI
        categories.push(p.kategori.trim())
      }
    }
  })

  // Filter Logika
  const filteredProducts = dbProducts.filter(p => {
    const productCat = p.kategori ? p.kategori.trim().toLowerCase() : ''
    const activeCat = activeCategory.trim().toLowerCase()
    
    const matchCategory = activeCategory === 'Semua' || productCat === activeCat
    const matchSearch = p.nama.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })
  // Logika Checkout Transaksi
  const handleCheckout = async (checkoutPaymentMethod, checkoutAmountPaid) => {
    if (cartItems.length === 0) return

    try {
      const paid = Number(checkoutAmountPaid) || 0;
      const kembalian = checkoutPaymentMethod === 'Tunai' ? paid - totalHarga : 0;
      const txTimestamp = new Date().getTime();

      // Cari shift aktif (yang belum ditutup / belum memiliki waktu_selesai)
      const allShifts = await db.shifts.orderBy("id").reverse().toArray();
      const activeShift = allShifts.find(s => !s.waktu_selesai && !s.end_time);
      const currentShiftId = activeShift ? activeShift.id : null;

      // ATOMIC TRANSACTION: Pastikan simpan nota dan potong stok terjadi bersamaan (anti-bocor)
      await db.transaction('rw', [db.transactions, db.products], async () => {
        // 1. Simpan Transaksi ke Database
        await db.transactions.add({
          shift_id: currentShiftId,
          total: totalHarga,
          items: [...cartItems],
          payment_method: checkoutPaymentMethod,
          amount_paid: checkoutPaymentMethod === 'Tunai' ? paid : totalHarga,
          kembalian: kembalian,
          timestamp: txTimestamp,
          user_id: user?.id || null,
        })

        // 2. Kurangi Stok Barang di Database
        for (const item of cartItems) {
          if (item.id) {
            const product = await db.products.get(item.id)
            if (product) {
              await db.products.update(item.id, {
                stok: Math.max(0, (product.stok || 0) - item.quantity)
              })
            }
          }
        }
      })

      // Tutup modal pembayaran & tampilkan struk
      setIsPaymentModalOpen(false)
      setIsMobileCartOpen(false)

      // Simpan data untuk ditampilkan di ReceiptModal
      setReceiptData({
        items: [...cartItems],
        total: totalHarga,
        kembalian,
        paymentMethod: checkoutPaymentMethod,
        amountPaid: checkoutPaymentMethod === 'Tunai' ? paid : totalHarga,
        timestamp: txTimestamp,
      })

    } catch (error) {
      console.error("Gagal melakukan transaksi:", error)
      useNotificationStore.getState().showAlert("Terjadi kesalahan saat memproses pembayaran.", "error")
    }
  }

  // Handler penutupan struk — baru clearCart di sini
  const handleCloseReceipt = () => {
    setReceiptData(null)
    clearCart()
  }

  return (
    <div className="flex h-full w-full relative">
      
      {/* ── BAGIAN KIRI: AREA PRODUK (QUICK-TAP) ────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        
        {/* Top Bar: Search & Kategori */}
        <div className="p-4 bg-surface border-b border-gray-100 z-10 shrink-0 shadow-sm">
          {/* Search Bar */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cari nama barang..."
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Kategori Chips (Bisa di-swipe horizontal) */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all active:scale-95 ${
                  activeCategory === cat
                    ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Produk */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-3 pb-24 lg:pb-4">
            {filteredProducts.map(product => {
              const effectivePrice = getEffectivePrice(product, isNightTimeNow);
              const isNightPriced = isNightTimeNow && product.harga_malam != null && product.harga_malam > 0;
              const isOutOfStock = (product.stok || 0) <= 0;
              
              return (
              <button
                key={product.id}
                onClick={() => {
                  if (!isOutOfStock) addItem(product, effectivePrice);
                  else useNotificationStore.getState().showAlert(`Stok ${product.nama} habis!`, "error");
                }}
                className={`group flex flex-row sm:flex-col items-center sm:items-start bg-surface rounded-xl p-2.5 sm:p-3 text-left border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all active:scale-[0.98] sm:active:scale-95 relative overflow-hidden ${isOutOfStock ? 'opacity-50' : ''}`}
              >
                {/* Indikator Stok: Garis Kiri di Mobile, Garis Atas di Desktop */}
                <div className={`absolute top-0 left-0 w-1 h-full sm:w-full sm:h-1 ${(product.stok || 0) <= 5 ? 'bg-red-400' : 'bg-green-400'}`} />
                
                {/* Wrapper Teks (Kiri di Mobile, Atas di Desktop) */}
                <div className="flex-1 min-w-0 pl-1.5 sm:pl-0 pr-2 sm:pr-0">
                  <div className="flex items-start justify-between gap-1.5">
                    <h3 className="text-[13px] sm:text-sm font-semibold text-gray-800 leading-snug mb-0.5 line-clamp-2 sm:mt-1">
                      {product.nama}
                    </h3>
                    {isNightPriced && (
                      <div className="shrink-0 bg-indigo-100 text-indigo-700 p-1 rounded-full shadow-sm sm:absolute sm:top-1.5 sm:right-1.5" title="Tarif Malam Aktif">
                        <Moon className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 sm:mb-3">{product.kategori} • Stok: {product.stok || 0}</p>
                </div>
                
                {/* Wrapper Harga & Aksi (Kanan di Mobile, Bawah di Desktop) */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center sm:justify-between sm:w-full sm:mt-auto sm:pt-1.5 gap-1 sm:gap-0 shrink-0">
                  <span className={`font-bold text-[13px] sm:text-base whitespace-nowrap ${isNightPriced ? 'text-indigo-600' : 'text-primary-600'}`}>
                    {formatRupiah(effectivePrice)}
                  </span>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
              </button>
            )})}
          </div>
        </div>

      </div>

      {/* ── BAGIAN KANAN: KERANJANG (CART) ─────────────────────────────── */}
      
      {/* Overlay Background Mobile */}
      {isMobileCartOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileCartOpen(false)}
        />
      )}

      {/* Panel Keranjang (Tetap di kanan untuk desktop, Slide dari bawah untuk mobile) */}
      <div className={`
        fixed lg:static top-0 right-0 w-full lg:w-96 h-full bg-surface shadow-2xl lg:shadow-none lg:border-l border-gray-100 z-50
        flex flex-col transform transition-transform duration-300 ease-in-out
        ${isMobileCartOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0'}
      `}>
        
        {/* Header Keranjang */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-surface">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Keranjang</h2>
            <p className="text-sm text-gray-500">{totalBarang} Barang</p>
          </div>
          <div className="flex gap-2">
            {totalBarang > 0 && (
              <button 
                onClick={clearCart}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                title="Kosongkan Keranjang"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => setIsMobileCartOpen(false)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Daftar Item Keranjang */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <ShoppingBag className="w-16 h-16 opacity-20" />
              <p>Keranjang masih kosong</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-surface p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800 leading-tight mb-1">{item.nama}</h4>
                    <p className="font-bold text-primary-600">{formatRupiah(item.subtotal)}</p>
                  </div>
                  
                  {/* Kontrol Quantity */}
                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-200">
                    <button 
                      onClick={() => removeOneItem(item.id)}
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-white rounded-md shadow-sm transition-all"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-semibold w-4 text-center text-sm">{item.quantity}</span>
                    <button 
                      onClick={() => addItem(item)}
                      className="w-8 h-8 flex items-center justify-center text-primary-600 hover:bg-white rounded-md shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Keranjang (Total & Bayar) */}
        <div className="p-6 bg-surface border-t border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-500 font-medium">Total Tagihan</span>
            <span className="text-2xl font-bold text-gray-900">{formatRupiah(totalHarga)}</span>
          </div>
          <button 
            disabled={cartItems.length === 0}
            onClick={() => setIsPaymentModalOpen(true)}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95 flex justify-center items-center gap-2 ${
              cartItems.length === 0 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary-500 text-white shadow-lg shadow-primary-500/40 hover:bg-primary-600'
            }`}
          >
            BAYAR SEKARANG
          </button>
        </div>
      </div>

      {/* ── MODAL PEMBAYARAN ─────────────────────────────────────────── */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalHarga={totalHarga}
        onCheckout={handleCheckout}
      />

      {/* ── STRUK PEMBAYARAN (On-Screen Receipt Modal) ───────────────────── */}
      <ReceiptModal
        isOpen={!!receiptData}
        onClose={handleCloseReceipt}
        receiptData={receiptData}
      />

      {/* ── TOMBOL FLOAT MOBILE (Membuka Keranjang) ──────────────────────── */}
      {!isMobileCartOpen && (
        <button 
          onClick={() => setIsMobileCartOpen(true)}
          className="lg:hidden fixed bottom-20 left-4 right-4 bg-primary-500 text-white p-4 rounded-2xl shadow-xl shadow-primary-500/30 flex justify-between items-center z-20 active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="w-6 h-6" />
              {totalBarang > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-primary-500">
                  {totalBarang}
                </span>
              )}
            </div>
            <span className="font-medium">Lihat Keranjang</span>
          </div>
          <span className="font-bold text-lg">{formatRupiah(totalHarga)}</span>
        </button>
      )}

    </div>
  )
}

export default POSPage
