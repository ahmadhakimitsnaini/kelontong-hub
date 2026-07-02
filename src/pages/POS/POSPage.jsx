import React, { useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingBag, X, CheckCircle, CreditCard, Banknote, Wallet } from 'lucide-react'
import useCartStore from '../../store/useCartStore'
import { formatRupiah, formatRibuan } from '../../lib/utils'
import db from '../../db/db'
import useNotificationStore from '../../store/useNotificationStore'

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

  // Local State
  const [activeCategory, setActiveCategory] = useState('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Tunai')
  const [amountPaid, setAmountPaid] = useState('')

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
  const handleCheckout = async () => {
    if (cartItems.length === 0) return

    const paid = Number(amountPaid) || 0;
    if (paymentMethod === 'Tunai' && paid < totalHarga) {
      useNotificationStore.getState().showAlert("Jumlah uang tunai kurang dari total tagihan!", "error");
      return;
    }

    try {
      const kembalian = paymentMethod === 'Tunai' ? paid - totalHarga : 0;

      // ATOMIC TRANSACTION: Pastikan simpan nota dan potong stok terjadi bersamaan (anti-bocor)
      await db.transaction('rw', [db.transactions, db.products], async () => {
        // 1. Simpan Transaksi ke Database
        await db.transactions.add({
          total: totalHarga,
          items: [...cartItems],
          payment_method: paymentMethod,
          amount_paid: paymentMethod === 'Tunai' ? paid : totalHarga,
          kembalian: kembalian,
          timestamp: new Date().getTime()
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

      const msgKembalian = paymentMethod === 'Tunai' && kembalian > 0 ? `\nKembalian: ${formatRupiah(kembalian)}` : '';
      useNotificationStore.getState().showAlert(`Pembayaran berhasil! Total: ${formatRupiah(totalHarga)}${msgKembalian}`, "success")
      
      clearCart()
      setIsMobileCartOpen(false)
      setIsPaymentModalOpen(false)
      setAmountPaid('')
      setPaymentMethod('Tunai')
    } catch (error) {
      console.error("Gagal melakukan transaksi:", error)
      useNotificationStore.getState().showAlert("Terjadi kesalahan saat memproses pembayaran.", "error")
    }
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-24 lg:pb-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addItem(product)}
                className="group flex flex-col bg-surface rounded-2xl p-4 text-left border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all active:scale-95 relative overflow-hidden"
              >
                {/* Indikator Stok */}
                <div className={`absolute top-0 left-0 w-full h-1 ${(product.stok || 0) <= 5 ? 'bg-red-400' : 'bg-green-400'}`} />
                
                <h3 className="font-semibold text-gray-800 leading-tight mb-1 line-clamp-2 mt-1">
                  {product.nama}
                </h3>
                <p className="text-xs text-gray-500 mb-4">{product.kategori} • Stok: {product.stok || 0}</p>
                <div className="mt-auto pt-2 flex items-center justify-between w-full">
                  <span className="font-bold text-primary-600 text-lg">
                    {formatRupiah(product.harga_jual)}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                    <Plus className="w-5 h-5" />
                  </div>
                </div>
              </button>
            ))}
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
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">Detail Pembayaran</h2>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {/* Info Tagihan */}
              <div className="bg-primary-50 p-4 rounded-xl border border-primary-100 flex flex-col items-center justify-center">
                <span className="text-sm font-medium text-primary-600 mb-1">Total Tagihan</span>
                <span className="text-3xl font-bold text-primary-700">{formatRupiah(totalHarga)}</span>
              </div>

              {/* Pilihan Metode Pembayaran */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('Tunai')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      paymentMethod === 'Tunai' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Banknote className="w-6 h-6" />
                    <span className="text-xs font-semibold">Tunai</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      paymentMethod === 'QRIS' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Wallet className="w-6 h-6" />
                    <span className="text-xs font-semibold">QRIS</span>
                  </button>
                </div>
              </div>

              {/* Input Uang Tunai */}
              {paymentMethod === 'Tunai' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Uang Diterima (Rp)</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={formatRibuan(amountPaid)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setAmountPaid(raw ? Number(raw) : '');
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all bg-white text-gray-800"
                  />
                  {/* Shortcut Nominal Cepat */}
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                    {[20000, 50000, 100000].map((nominal) => (
                      <button
                        key={nominal}
                        onClick={() => setAmountPaid(nominal.toString())}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg whitespace-nowrap transition-colors"
                      >
                        {formatRupiah(nominal)}
                      </button>
                    ))}
                    <button
                      onClick={() => setAmountPaid(totalHarga.toString())}
                      className="px-3 py-1.5 bg-primary-100 hover:bg-primary-200 text-primary-700 text-sm font-medium rounded-lg whitespace-nowrap transition-colors"
                    >
                      Uang Pas
                    </button>
                  </div>
                </div>
              )}

              {/* Info Kembalian */}
              {paymentMethod === 'Tunai' && (Number(amountPaid) > totalHarga) && (
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-200 animate-in fade-in">
                  <span className="text-green-700 font-medium">Kembalian:</span>
                  <span className="text-xl font-bold text-green-700">{formatRupiah(Number(amountPaid) - totalHarga)}</span>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <button 
                onClick={handleCheckout}
                className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Selesaikan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

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
