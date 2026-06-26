import React, { useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingBag, X } from 'lucide-react'
import useCartStore from '../../store/useCartStore'
import { formatRupiah } from '../../lib/utils'
import db from '../../db/db'

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

  // Ambil data produk asli dari database
  const dbProducts = useLiveQuery(() => db.products.toArray(), []) || []

  // Ekstrak daftar kategori unik dari data produk
  const categories = ['Semua', ...new Set(dbProducts.map(p => p.kategori).filter(Boolean))]

  // Filter Logika
  const filteredProducts = dbProducts.filter(p => {
    const matchCategory = activeCategory === 'Semua' || p.kategori === activeCategory
    const matchSearch = p.nama.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })
  // Logika Checkout Transaksi
  const handleCheckout = async () => {
    if (cartItems.length === 0) return

    try {
      // 1. Simpan Transaksi ke Database
      await db.transactions.add({
        total: totalHarga,
        items: [...cartItems],
        timestamp: new Date().getTime()
      })

      // 2. Kurangi Stok Barang di Database
      for (const item of cartItems) {
        if (item.id) {
          const product = await db.products.get(item.id)
          if (product) {
            await db.products.update(item.id, {
              stok: Math.max(0, product.stok - item.quantity)
            })
          }
        }
      }

      alert(`Pembayaran berhasil! Total: ${formatRupiah(totalHarga)}`)
      clearCart()
      setIsMobileCartOpen(false)
    } catch (error) {
      console.error("Gagal melakukan transaksi:", error)
      alert("Terjadi kesalahan saat memproses pembayaran.")
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
                <div className={`absolute top-0 left-0 w-full h-1 ${product.stok <= 10 ? 'bg-red-400' : 'bg-green-400'}`} />
                
                <h3 className="font-semibold text-gray-800 leading-tight mb-1 line-clamp-2 mt-1">
                  {product.nama}
                </h3>
                <p className="text-xs text-gray-500 mb-4">{product.kategori} • Stok: {product.stok}</p>
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
            onClick={handleCheckout}
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
