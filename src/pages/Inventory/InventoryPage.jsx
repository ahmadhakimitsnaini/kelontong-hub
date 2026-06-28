import React, { useState } from 'react'
import { Plus, Search, Filter, AlertTriangle, Clock, Trash2, Edit, ArrowRightLeft } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../../db/db'
import { formatRupiah, formatTanggal, getKadaluwarsaClass, hitungSisaHari } from '../../lib/utils'

const InventoryPage = () => {
  // ── STATE MANAJEMEN ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('Semua') // 'Semua' | 'Kritis' | 'EtalaseMenipis' | 'GudangMenipis'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferData, setTransferData] = useState({ productId: null, amount: '', fromLocation: 'gudang' })
  
  // State Form Tambah Barang
  const [formData, setFormData] = useState({
    nama: '',
    kategori: '',
    harga_beli: '',
    harga_jual: '',
    stok_gudang: '',
    stok_etalase: '',
    expiry_date: ''
  })

  // ── MENGAMBIL DATA DARI DEXIE SECARA REAL-TIME ────────────────────────────
  // useLiveQuery memastikan jika ada perubahan di db.products, tampilan langsung update
  const products = useLiveQuery(() => db.products.toArray(), [])

  // ── LOGIKA FILTER (PENCARIAN & STATUS) ────────────────────────────────────
  const filteredProducts = (products || []).filter(product => {
    // 1. Filter Pencarian Nama
    const matchSearch = product.nama.toLowerCase().includes(searchQuery.toLowerCase())
    
    // 2. Filter Status (Kritis / Stok Menipis)
    let matchStatus = true
    if (filterMode === 'Kritis') {
      const sisaHari = hitungSisaHari(product.expiry_date)
      matchStatus = sisaHari !== null && sisaHari <= 7 // Kritis jika kadaluwarsa <= 7 hari
    } else if (filterMode === 'EtalaseMenipis') {
      matchStatus = product.stok_etalase <= 5
    } else if (filterMode === 'GudangMenipis') {
      matchStatus = product.stok_gudang <= 5
    }

    return matchSearch && matchStatus
  })

  // ── LOGIKA SIMPAN & HAPUS BARANG (CRUD) ───────────────────────────────────
  const handleSimpanBarang = async (e) => {
    e.preventDefault()
    try {
      // Memasukkan data ke IndexedDB
      await db.products.add({
        nama: formData.nama,
        kategori: formData.kategori,
        harga_beli: parseInt(formData.harga_beli),
        harga_jual: parseInt(formData.harga_jual),
        stok_gudang: parseInt(formData.stok_gudang) || 0,
        stok_etalase: parseInt(formData.stok_etalase) || 0,
        expiry_date: formData.expiry_date || null
      })
      
      // Reset form & tutup modal
      setFormData({ nama: '', kategori: '', harga_beli: '', harga_jual: '', stok_gudang: '', stok_etalase: '', expiry_date: '' })
      setIsModalOpen(false)
    } catch (error) {
      console.error("Gagal menyimpan barang:", error)
      alert("Terjadi kesalahan saat menyimpan barang.")
    }
  }

  const handleHapusBarang = async (id) => {
    if (window.confirm("Yakin ingin menghapus barang ini dari sistem?")) {
      await db.products.delete(id)
    }
  }

  const handleTransferStock = async (e) => {
    e.preventDefault()
    try {
      const product = await db.products.get(transferData.productId)
      const amount = parseInt(transferData.amount)
      
      if (transferData.fromLocation === 'gudang') {
        if (product.stok_gudang < amount) {
          alert('Stok gudang tidak mencukupi!')
          return
        }
        product.stok_gudang -= amount
        product.stok_etalase += amount
      } else {
        if (product.stok_etalase < amount) {
          alert('Stok etalase tidak mencukupi!')
          return
        }
        product.stok_etalase -= amount
        product.stok_gudang += amount
      }
      
      await db.products.put(product)
      setIsTransferModalOpen(false)
      setTransferData({ productId: null, amount: '', fromLocation: 'gudang' })
    } catch (err) {
      console.error(err)
      alert("Gagal memindahkan stok")
    }
  }

  // ── RENDER ANTARMUKA ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background relative p-4 md:p-6 lg:p-8">
      
      {/* ── HEADER & KONTROL ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaris Barang</h1>
          <p className="text-gray-500 text-sm mt-1">Total {products?.length || 0} jenis barang terdaftar di warung.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/40 border-2 border-green-400/50 hover:-translate-y-1 active:translate-y-0 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Barang</span>
        </button>
      </div>

      {/* ── FILTER & PENCARIAN ───────────────────────────────────────────── */}
      <div className="bg-surface p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Cari nama barang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
        
        {/* Chips Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 md:pb-0">
          <button 
            onClick={() => setFilterMode('Semua')}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${filterMode === 'Semua' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Semua Barang
          </button>
          <button 
            onClick={() => setFilterMode('Kritis')}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-all ${filterMode === 'Kritis' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            <Clock className="w-4 h-4" /> Kadaluwarsa
          </button>
          <button 
            onClick={() => setFilterMode('EtalaseMenipis')}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-all ${filterMode === 'EtalaseMenipis' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
          >
            <AlertTriangle className="w-4 h-4" /> Etalase Menipis
          </button>
          <button 
            onClick={() => setFilterMode('GudangMenipis')}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-all ${filterMode === 'GudangMenipis' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
          >
            <AlertTriangle className="w-4 h-4" /> Gudang Menipis
          </button>
        </div>
      </div>

      {/* ── TABEL/LIST BARANG ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-surface rounded-2xl shadow-sm border border-gray-100">
        <div className="min-w-[800px]">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 bg-gray-50/80 font-semibold text-gray-600 text-sm">
            <div className="col-span-3">Info Barang</div>
            <div className="col-span-2">Harga Beli/Jual</div>
            <div className="col-span-2 text-center">Sisa Stok</div>
            <div className="col-span-3">Status Kadaluwarsa (FIFO)</div>
            <div className="col-span-2 text-right">Aksi</div>
          </div>

          {/* Table Body */}
          {filteredProducts.length === 0 ? (
            <div className="p-10 text-center text-gray-400">Tidak ada barang yang ditemukan.</div>
          ) : (
            <div className="flex flex-col">
              {filteredProducts.map(product => {
                const kadaluwarsa = getKadaluwarsaClass(product.expiry_date)
                return (
                  <div key={product.id} className="grid grid-cols-12 gap-4 p-4 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors">
                    {/* Kolom 1: Info Produk */}
                    <div className="col-span-3">
                      <h3 className="font-bold text-gray-900">{product.nama}</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                        {product.kategori}
                      </span>
                    </div>

                    {/* Kolom 2: Harga */}
                    <div className="col-span-2 flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{formatRupiah(product.harga_jual)}</span>
                      <span className="text-xs text-gray-400" title="Modal">M: {formatRupiah(product.harga_beli)}</span>
                    </div>

                    {/* Kolom 3: Stok (Gudang & Etalase) */}
                    <div className="col-span-2 flex justify-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="font-bold text-gray-800 text-base">
                          Total: {(product.stok_gudang || 0) + (product.stok_etalase || 0)}
                        </div>
                        <div className="flex gap-2 mt-1 text-[10px] font-medium">
                          <span className={`px-2 py-0.5 border rounded-md ${product.stok_gudang <= 5 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                            📦 Gud: {product.stok_gudang || 0}
                          </span>
                          <span className={`px-2 py-0.5 border rounded-md ${product.stok_etalase <= 5 ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-green-50 text-green-600 border-green-100'}`}>
                            🏪 Eta: {product.stok_etalase || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Kolom 4: FIFO & Kadaluwarsa */}
                    <div className="col-span-3 flex flex-col items-start justify-center">
                      <div className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 mb-1 ${kadaluwarsa.badge}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${kadaluwarsa.dot}`}></div>
                        {kadaluwarsa.label}
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {product.expiry_date ? formatTanggal(product.expiry_date) : 'Tidak ada tgl'}
                      </span>
                    </div>

                    {/* Kolom 5: Aksi */}
                    <div className="col-span-2 flex justify-end gap-2">
                      <button 
                        onClick={() => { setTransferData({ ...transferData, productId: product.id }); setIsTransferModalOpen(true); }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Transfer Stok"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleHapusBarang(product.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL TAMBAH BARANG ──────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Tambah Barang Baru</h2>
            </div>
            
            <form onSubmit={handleSimpanBarang} className="p-6">
              <div className="space-y-4">
                
                {/* Nama & Kategori */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Barang</label>
                    <input required type="text" value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                    <input required type="text" placeholder="Cth: Sembako" value={formData.kategori} onChange={(e) => setFormData({...formData, kategori: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  </div>
                </div>

                {/* Harga Beli & Harga Jual */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Harga Beli (Modal)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">Rp</span>
                      <input required type="number" value={formData.harga_beli} onChange={(e) => setFormData({...formData, harga_beli: e.target.value})} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">Rp</span>
                      <input required type="number" value={formData.harga_jual} onChange={(e) => setFormData({...formData, harga_jual: e.target.value})} className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                    </div>
                  </div>
                </div>

                {/* Stok & Kadaluwarsa */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📦 Stok Gudang</label>
                    <input required type="number" value={formData.stok_gudang} onChange={(e) => setFormData({...formData, stok_gudang: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">🏪 Stok Etalase</label>
                    <input required type="number" value={formData.stok_etalase} onChange={(e) => setFormData({...formData, stok_etalase: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none" />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tgl Kadaluwarsa (Opsi)</label>
                  <input type="date" value={formData.expiry_date} onChange={(e) => setFormData({...formData, expiry_date: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-700" />
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 shadow-lg shadow-green-500/40 transition-all active:scale-95">Simpan Barang</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL TRANSFER STOK ────────────────────────────────────────────── */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Transfer Stok</h2>
            </div>
            <form onSubmit={handleTransferStock} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dari Lokasi</label>
                  <select 
                    value={transferData.fromLocation} 
                    onChange={e => setTransferData({ ...transferData, fromLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none"
                  >
                    <option value="gudang">📦 Gudang → 🏪 Etalase</option>
                    <option value="etalase">🏪 Etalase → 📦 Gudang</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Pindah</label>
                  <input 
                    required type="number" 
                    min="1"
                    value={transferData.amount} 
                    onChange={e => setTransferData({ ...transferData, amount: e.target.value })} 
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="px-5 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-all">Pindahkan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default InventoryPage
