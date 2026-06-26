import React, { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, DollarSign, Receipt, Plus, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../../db/db'
import { formatRupiah, formatTanggal } from '../../lib/utils'

const DashboardPage = () => {
  // ── 1. MENDAPATKAN RENTANG WAKTU HARI INI ───────────────────────────────
  const getTodayRange = () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    
    return { start: start.getTime(), end: end.getTime() }
  }
  const today = getTodayRange()

  // ── 2. MENGAMBIL DATA SECARA REAL-TIME DARI DEXIE ───────────────────────
  // Mengambil Transaksi Hari Ini
  const transactions = useLiveQuery(
    () => db.transactions.where('timestamp').between(today.start, today.end).reverse().toArray(),
    []
  )

  // Mengambil Pengeluaran Hari Ini
  const expenses = useLiveQuery(
    () => db.expenses.where('timestamp').between(today.start, today.end).reverse().toArray(),
    []
  )

  // ── 3. LOGIKA KALKULASI LABA / RUGI ─────────────────────────────────────
  let totalOmzet = 0
  let totalModal = 0

  if (transactions) {
    transactions.forEach(trx => {
      totalOmzet += trx.total
      
      // Menghitung total modal (harga beli) dari setiap barang di struk
      if (trx.items && Array.isArray(trx.items)) {
        trx.items.forEach(item => {
          totalModal += (item.harga_beli * item.quantity)
        })
      }
    })
  }

  const labaKotor = totalOmzet - totalModal

  let totalPengeluaran = 0
  if (expenses) {
    expenses.forEach(exp => {
      totalPengeluaran += exp.amount
    })
  }

  const labaBersih = labaKotor - totalPengeluaran
  const isProfit = labaBersih >= 0

  // ── 4. STATE & LOGIKA FORM PENGELUARAN ──────────────────────────────────
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' })

  const handleAddExpense = async (e) => {
    e.preventDefault()
    if (!expenseForm.description || !expenseForm.amount) return

    try {
      await db.expenses.add({
        description: expenseForm.description,
        amount: parseInt(expenseForm.amount),
        timestamp: new Date().getTime()
      })
      setExpenseForm({ description: '', amount: '' })
    } catch (error) {
      console.error("Gagal mencatat pengeluaran:", error)
      alert("Terjadi kesalahan saat mencatat pengeluaran.")
    }
  }

  const handleDeleteExpense = async (id) => {
    if (window.confirm("Yakin ingin menghapus catatan pengeluaran ini?")) {
      await db.expenses.delete(id)
    }
  }

  // ── 5. RENDER ANTARMUKA ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-auto p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Keuangan</h1>
        <p className="text-gray-500 text-sm mt-1">Ringkasan transaksi dan laba rugi hari ini: {formatTanggal(new Date().toISOString())}</p>
      </div>

      {/* ── KARTU METRIK UTAMA (GRID) ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Kartu Omzet */}
        <div className="bg-surface p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Omzet</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatRupiah(totalOmzet)}</h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400">Total uang masuk dari penjualan</p>
        </div>

        {/* Kartu Laba Kotor */}
        <div className="bg-surface p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Laba Kotor</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatRupiah(labaKotor)}</h3>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400">Omzet dikurangi modal barang</p>
        </div>

        {/* Kartu Pengeluaran */}
        <div className="bg-surface p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Pengeluaran Kas</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatRupiah(totalPengeluaran)}</h3>
            </div>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400">Total biaya operasional hari ini</p>
        </div>

        {/* Kartu LABA BERSIH (Paling Menonjol) */}
        <div className={`p-5 rounded-2xl shadow-lg flex flex-col justify-between transform transition-all hover:-translate-y-1 ${
          isProfit 
            ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-green-500/30 text-white' 
            : 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/30 text-white'
        }`}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium opacity-90 mb-1">Keuntungan Bersih</p>
              <h3 className="text-3xl font-bold">{formatRupiah(labaBersih)}</h3>
            </div>
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs opacity-80 font-medium">Laba Kotor - Pengeluaran Kas</p>
        </div>

      </div>

      {/* ── BAGIAN BAWAH: FORM PENGELUARAN & DAFTAR TRANSAKSI ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kolom Kiri: Form & List Pengeluaran */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Form Pengeluaran */}
          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-gray-400" /> 
              Catat Pengeluaran
            </h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Keterangan (Misal: Es Batu, Listrik)</label>
                <input 
                  type="text" 
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="Keterangan..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nominal (Rp)</label>
                <input 
                  type="number" 
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah Catatan
              </button>
            </form>
          </div>

          {/* List Pengeluaran Hari Ini */}
          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Pengeluaran Hari Ini</h3>
            {!expenses || expenses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Belum ada pengeluaran dicatat.</p>
            ) : (
              <div className="space-y-3">
                {expenses.map(exp => (
                  <div key={exp.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{exp.description}</p>
                      <p className="text-xs text-gray-500">{new Date(exp.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-red-600">-{formatRupiah(exp.amount)}</span>
                      <button onClick={() => handleDeleteExpense(exp.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Kolom Kanan: Riwayat Transaksi Terakhir */}
        <div className="lg:col-span-2">
          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-gray-100 h-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              Riwayat Transaksi (Hari Ini)
            </h3>
            
            <div className="overflow-x-auto">
              {!transactions || transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Receipt className="w-12 h-12 mb-3 opacity-20" />
                  <p>Belum ada transaksi penjualan hari ini.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-sm text-gray-500">
                      <th className="pb-3 font-medium w-1/4">Waktu</th>
                      <th className="pb-3 font-medium w-2/4">Item Terjual</th>
                      <th className="pb-3 font-medium text-right w-1/4">Total Penjualan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(trx => (
                      <tr key={trx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 text-sm text-gray-600">
                          {new Date(trx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="py-3 text-sm text-gray-900 font-medium">
                          {trx.items ? trx.items.map(i => `${i.quantity}x ${i.nama}`).join(', ') : '-'}
                        </td>
                        <td className="py-3 text-sm font-bold text-primary-600 text-right">
                          {formatRupiah(trx.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}

export default DashboardPage
