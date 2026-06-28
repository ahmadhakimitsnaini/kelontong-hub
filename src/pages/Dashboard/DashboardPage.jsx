import React, { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, DollarSign, Receipt, Plus, Trash2, CalendarDays } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../../db/db'
import { formatRupiah, formatTanggal } from '../../lib/utils'

// ── KONSTANTA PILIHAN RENTANG WAKTU ─────────────────────────────────────────
const TIME_RANGE_OPTIONS = ['Hari Ini', '7 Hari Terakhir', 'Bulan Ini', 'Semua Waktu']

// ── HELPER: MENGHITUNG RENTANG TIMESTAMP BERDASARKAN PILIHAN ────────────────
// Dibuat di luar komponen agar tidak dibuat ulang setiap render
const getTimeRange = (range) => {
  const now = new Date()
  // Akhir selalu "akhir hari ini"
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()

  if (range === 'Hari Ini') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
    return { start, end, useBetween: true }
  }

  if (range === '7 Hari Terakhir') {
    const past = new Date(now)
    past.setDate(now.getDate() - 6) // 6 hari ke belakang + hari ini = 7 hari total
    const start = new Date(past.getFullYear(), past.getMonth(), past.getDate(), 0, 0, 0, 0).getTime()
    return { start, end, useBetween: true }
  }

  if (range === 'Bulan Ini') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()
    return { start, end, useBetween: true }
  }

  // 'Semua Waktu': tidak gunakan filter between agar aman dari timestamp 0 / negatif
  return { start: 0, end: Infinity, useBetween: false }
}

// ── HELPER: FORMAT WAKTU ADAPTIF ────────────────────────────────────────────
// Jika filter bukan "Hari Ini", tampilkan tanggal + jam agar tidak ambigu
const formatWaktu = (timestamp, timeRange) => {
  const date = new Date(timestamp)
  const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  if (timeRange === 'Hari Ini') {
    return timeStr
  }

  const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  return `${dateStr}, ${timeStr}`
}

// ── HELPER: LABEL DESKRIPSI DINAMIS ─────────────────────────────────────────
const getRangeLabel = (range) => {
  const labels = {
    'Hari Ini': `hari ini: ${formatTanggal(new Date().toISOString())}`,
    '7 Hari Terakhir': '7 hari terakhir',
    'Bulan Ini': `bulan ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
    'Semua Waktu': 'semua periode'
  }
  return labels[range] || range
}

// ── HELPER: BADGE METODE PEMBAYARAN ─────────────────────────────────────────
const PaymentBadge = ({ method }) => {
  const styles = {
    'Tunai': 'bg-green-100 text-green-700',
    'QRIS': 'bg-purple-100 text-purple-700',
    'Transfer Bank': 'bg-blue-100 text-blue-700',
  }
  const label = method || 'Tunai'
  const style = styles[label] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style}`}>
      {label}
    </span>
  )
}

const DashboardPage = () => {
  // ── 1. STATE FILTER RENTANG WAKTU ────────────────────────────────────────
  const [timeRange, setTimeRange] = useState('Hari Ini')

  // ── 2. KALKULASI RENTANG WAKTU BERDASARKAN PILIHAN ───────────────────────
  const { start, end, useBetween } = getTimeRange(timeRange)

  // ── 3. MENGAMBIL DATA SECARA REAL-TIME DARI DEXIE ────────────────────────
  // Dependency array [timeRange] memastikan query dijalankan ulang saat filter berubah

  const transactions = useLiveQuery(
    () => {
      if (useBetween) {
        return db.transactions.where('timestamp').between(start, end).reverse().toArray()
      }
      // Semua Waktu: ambil semua, urutkan terbaru di atas
      return db.transactions.orderBy('timestamp').reverse().toArray()
    },
    [timeRange]
  )

  const expenses = useLiveQuery(
    () => {
      if (useBetween) {
        return db.expenses.where('timestamp').between(start, end).reverse().toArray()
      }
      return db.expenses.orderBy('timestamp').reverse().toArray()
    },
    [timeRange]
  )

  // ── 4. LOGIKA KALKULASI LABA / RUGI ──────────────────────────────────────
  let totalOmzet = 0
  let totalModal = 0
  let totalTunai = 0
  let totalQRIS = 0

  if (transactions) {
    transactions.forEach(trx => {
      totalOmzet += trx.total

      const method = trx.payment_method || 'Tunai'
      if (method === 'Tunai') totalTunai += trx.total
      else if (method === 'QRIS') totalQRIS += trx.total

      // Hitung total modal (harga beli x qty) dari setiap item di transaksi
      if (trx.items && Array.isArray(trx.items)) {
        trx.items.forEach(item => {
          totalModal += (item.harga_beli || 0) * item.quantity
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

  // ── 5. STATE & LOGIKA FORM PENGELUARAN ────────────────────────────────────
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

  // ── 6. RENDER ANTARMUKA ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-auto p-4 md:p-6 lg:p-8 space-y-6">

      {/* ── HEADER + DROPDOWN FILTER ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Keuangan</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ringkasan transaksi dan laba rugi untuk <span className="font-medium text-gray-700">{getRangeLabel(timeRange)}</span>
          </p>
        </div>

        {/* Dropdown Filter Rentang Waktu */}
        <div className="flex items-center gap-2 bg-surface border border-gray-200 rounded-xl px-3 py-2 shadow-sm self-start sm:self-auto">
          <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer pr-1"
          >
            {TIME_RANGE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KARTU METRIK UTAMA (GRID) ─────────────────────────────────────── */}
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
          <p className="text-xs text-gray-400">Total biaya operasional periode ini</p>
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

      {/* ── BAGIAN BAWAH: FORM PENGELUARAN & DAFTAR TRANSAKSI ────────────── */}
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

          {/* List Pengeluaran (Dinamis sesuai Filter) */}
          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">
              Pengeluaran — <span className="text-gray-500 font-normal capitalize">{timeRange}</span>
            </h3>
            {!expenses || expenses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Belum ada pengeluaran dicatat.</p>
            ) : (
              <div className="space-y-3">
                {expenses.map(exp => (
                  <div key={exp.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{exp.description}</p>
                      <p className="text-xs text-gray-500">
                        {/* Format waktu adaptif sesuai filter */}
                        {formatWaktu(exp.timestamp, timeRange)}
                      </p>
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

        {/* Kolom Kanan: Riwayat Transaksi */}
        <div className="lg:col-span-2">
          <div className="bg-surface p-5 rounded-2xl shadow-sm border border-gray-100 h-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              Riwayat Transaksi —
              <span className="text-base font-normal text-gray-500 capitalize">{timeRange}</span>
            </h3>
            
            {/* Ringkasan Metode Pembayaran */}
            {transactions && transactions.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="bg-green-50 px-4 py-3 rounded-xl border border-green-100 flex-1 min-w-[120px]">
                  <p className="text-xs text-green-600 font-semibold mb-1">Total Tunai</p>
                  <p className="text-lg font-bold text-green-700">{formatRupiah(totalTunai)}</p>
                </div>
                <div className="bg-purple-50 px-4 py-3 rounded-xl border border-purple-100 flex-1 min-w-[120px]">
                  <p className="text-xs text-purple-600 font-semibold mb-1">Total QRIS</p>
                  <p className="text-lg font-bold text-purple-700">{formatRupiah(totalQRIS)}</p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {!transactions || transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Receipt className="w-12 h-12 mb-3 opacity-20" />
                  <p>Belum ada transaksi penjualan pada periode ini.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-sm text-gray-500">
                      {/* Lebar kolom Waktu sedikit lebih besar saat filter non-hari ini */}
                      <th className="pb-3 font-medium w-[22%]">Waktu</th>
                      <th className="pb-3 font-medium">Item Terjual</th>
                      {/* Kolom Metode Pembayaran (Bonus Enhancement dari plan) */}
                      <th className="pb-3 font-medium w-[18%]">Metode</th>
                      <th className="pb-3 font-medium text-right w-[20%]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(trx => (
                      <tr key={trx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        {/* Waktu: format adaptif (jam saja vs tanggal+jam) */}
                        <td className="py-3 text-sm text-gray-600 whitespace-nowrap">
                          {formatWaktu(trx.timestamp, timeRange)}
                        </td>
                        <td className="py-3 text-sm text-gray-900 font-medium">
                          {trx.items ? trx.items.map(i => `${i.quantity}x ${i.nama}`).join(', ') : '-'}
                        </td>
                        {/* Metode Pembayaran dengan badge warna */}
                        <td className="py-3">
                          <PaymentBadge method={trx.payment_method} />
                        </td>
                        <td className="py-3 text-sm font-bold text-primary-600 text-right whitespace-nowrap">
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
