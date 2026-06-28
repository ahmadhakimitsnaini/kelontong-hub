import React, { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, FileText, BookOpen, AlertCircle,
  ChevronDown, CheckCircle, Clock, Plus, Trash2, PhoneCall, Download,
  ArrowUpRight, ArrowDownRight, BarChart3, Scale, Activity, Users, X,
  CalendarDays, ArrowRight
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../../db/db'
import { formatRupiah, formatTanggal, formatTanggalSingkat } from '../../lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TIME_OPTIONS = ['Bulan Ini', '7 Hari Terakhir', 'Hari Ini', 'Semua Waktu']

const getRange = (range) => {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
  if (range === 'Hari Ini') {
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime(), end, useBetween: true }
  }
  if (range === '7 Hari Terakhir') {
    const p = new Date(now); p.setDate(now.getDate() - 6)
    return { start: new Date(p.getFullYear(), p.getMonth(), p.getDate(), 0, 0, 0, 0).getTime(), end, useBetween: true }
  }
  if (range === 'Bulan Ini') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime(), end, useBetween: true }
  }
  return { start: 0, end: Infinity, useBetween: false }
}

// Hitung berapa hari lagi jatuh tempo
const getDueDays = (due_date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(due_date); due.setHours(0, 0, 0, 0)
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

// Label status jatuh tempo beserta style-nya
const getDueStyle = (dueDays) => {
  if (dueDays < 0) return { label: `Terlambat ${Math.abs(dueDays)} hari`, cls: 'bg-red-100 text-red-700' }
  if (dueDays <= 3) return { label: `Jatuh tempo ${dueDays} hari lagi`, cls: 'bg-orange-100 text-orange-700' }
  return { label: `${dueDays} hari lagi`, cls: 'bg-green-100 text-green-700' }
}

// Perbandingan MoM: hitung total bulan lalu dari data
const getPrevMonthTotal = (allTransactions, fieldFn) => {
  const now = new Date()
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime()
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime()
  return (allTransactions || [])
    .filter(t => t.timestamp >= prevStart && t.timestamp <= prevEnd)
    .reduce((sum, t) => sum + fieldFn(t), 0)
}

// Format persentase MoM
const formatMoM = (current, previous) => {
  if (previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct).toFixed(1), isUp: pct >= 0 }
}

// Export ke CSV
const exportCSV = (headers, rows, filename) => {
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-KOMPONEN: KARTU SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
const SummaryCard = ({ label, value, icon: Icon, colorCls, sub, mom }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <div className={`p-2 rounded-xl ${colorCls}`}><Icon className="w-4 h-4" /></div>
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    <div className="flex items-center gap-2 flex-wrap">
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {mom && (
        <span className={`flex items-center gap-0.5 text-xs font-semibold ${mom.isUp ? 'text-green-600' : 'text-red-600'}`}>
          {mom.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {mom.pct}% vs bln lalu
        </span>
      )}
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// TAB: LAPORAN LABA RUGI (Profit & Loss)
// ─────────────────────────────────────────────────────────────────────────────
const TabLabaRugi = ({ transactions, expenses, allTransactions, timeRange }) => {
  // Kalkulasi P&L
  let pendapatanKotor = 0, hpp = 0, bebanOperasional = 0
  ;(transactions || []).forEach(trx => {
    pendapatanKotor += trx.total
    ;(trx.items || []).forEach(item => { hpp += (item.harga_beli || 0) * item.quantity })
  })
  ;(expenses || []).forEach(exp => { bebanOperasional += exp.amount })

  const labaKotor = pendapatanKotor - hpp
  const labaBersih = labaKotor - bebanOperasional
  const marginKotor = pendapatanKotor > 0 ? ((labaKotor / pendapatanKotor) * 100).toFixed(1) : 0
  const marginBersih = pendapatanKotor > 0 ? ((labaBersih / pendapatanKotor) * 100).toFixed(1) : 0

  // MoM
  const prevOmzet = getPrevMonthTotal(allTransactions, t => t.total)
  const momOmzet = formatMoM(pendapatanKotor, prevOmzet)

  // Waterfall bar (persentase terhadap omzet)
  const barPct = (val) => pendapatanKotor > 0 ? Math.min(100, Math.abs((val / pendapatanKotor) * 100)) : 0

  const handleExport = () => {
    exportCSV(
      ['Item', 'Nilai (Rp)'],
      [
        ['Pendapatan Kotor (Omzet)', pendapatanKotor],
        ['HPP (Harga Pokok Penjualan)', `-${hpp}`],
        ['Laba Kotor', labaKotor],
        ['Beban Operasional', `-${bebanOperasional}`],
        ['Laba Bersih', labaBersih],
      ],
      `laporan-laba-rugi-${timeRange.replace(/ /g, '-')}.csv`
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Pendapatan Kotor" value={formatRupiah(pendapatanKotor)} icon={Wallet} colorCls="bg-blue-50 text-blue-600" mom={momOmzet} />
        <SummaryCard label="HPP (Modal Barang)" value={formatRupiah(hpp)} icon={TrendingDown} colorCls="bg-orange-50 text-orange-600" sub="Harga beli × kuantitas" />
        <SummaryCard label="Laba Kotor" value={formatRupiah(labaKotor)} icon={TrendingUp} colorCls="bg-indigo-50 text-indigo-600" sub={`Margin ${marginKotor}%`} />
        <SummaryCard label="Laba Bersih" value={formatRupiah(labaBersih)} icon={labaBersih >= 0 ? TrendingUp : TrendingDown} colorCls={labaBersih >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'} sub={`Margin ${marginBersih}%`} />
      </div>

      {/* Waterfall Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-gray-800">Struktur Laba Rugi</h3>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> Ekspor CSV
          </button>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Pendapatan Kotor (Omzet)', value: pendapatanKotor, color: 'bg-blue-500', textColor: 'text-blue-700', prefix: '+' },
            { label: 'HPP (Harga Pokok Penjualan)', value: hpp, color: 'bg-orange-400', textColor: 'text-orange-700', prefix: '–' },
            { label: 'Laba Kotor', value: labaKotor, color: 'bg-indigo-500', textColor: 'text-indigo-700', prefix: '=' },
            { label: 'Beban Operasional', value: bebanOperasional, color: 'bg-red-400', textColor: 'text-red-700', prefix: '–' },
            { label: 'Laba Bersih', value: labaBersih, color: labaBersih >= 0 ? 'bg-green-500' : 'bg-red-500', textColor: labaBersih >= 0 ? 'text-green-700' : 'text-red-700', prefix: '=' },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-4">
              <div className="w-4 text-xs font-bold text-gray-400 shrink-0 text-center">{row.prefix}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-700">{row.label}</span>
                  <span className={`text-sm font-bold ${row.textColor}`}>{formatRupiah(Math.abs(row.value))}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${row.color} rounded-full transition-all duration-700`} style={{ width: `${barPct(row.value)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: NERACA KEUANGAN (Balance Sheet)
// ─────────────────────────────────────────────────────────────────────────────
const TabNeraca = ({ transactions, debts, receivables, products }) => {
  // ASET
  const kasTotal = (transactions || []).reduce((sum, t) => {
    if (t.payment_method === 'Tunai' || !t.payment_method) return sum + t.total
    return sum
  }, 0)
  const nilaiStok = (products || []).reduce((sum, p) => sum + ((p.harga_beli || 0) * p.stok), 0)
  const totalPiutang = (receivables || []).filter(r => r.status === 'ACTIVE').reduce((sum, r) => sum + r.amount, 0)
  const totalAset = kasTotal + nilaiStok + totalPiutang

  // KEWAJIBAN
  const totalHutang = (debts || []).filter(d => d.status !== 'PAID').reduce((sum, d) => sum + (d.amount - (d.paid_amount || 0)), 0)

  // EKUITAS (= Aset - Kewajiban)
  const ekuitas = totalAset - totalHutang
  const isBalanced = Math.abs(totalAset - (totalHutang + ekuitas)) < 1

  return (
    <div className="space-y-6">
      {/* Rumus Balance Sheet */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <p className="text-blue-200 text-xs font-medium mb-2">Rumus Akuntansi</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-center"><p className="text-xs opacity-75">Total Aset</p><p className="text-xl font-bold">{formatRupiah(totalAset)}</p></div>
          <div className="text-2xl font-light opacity-60">=</div>
          <div className="text-center"><p className="text-xs opacity-75">Total Kewajiban</p><p className="text-xl font-bold">{formatRupiah(totalHutang)}</p></div>
          <div className="text-2xl font-light opacity-60">+</div>
          <div className="text-center"><p className="text-xs opacity-75">Ekuitas</p><p className="text-xl font-bold">{formatRupiah(ekuitas)}</p></div>
          <div className={`ml-auto flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isBalanced ? 'bg-green-400/30 text-green-200' : 'bg-red-400/30 text-red-200'}`}>
            {isBalanced ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {isBalanced ? 'Balanced ✓' : 'Tidak Balance!'}
          </div>
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ASET */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-blue-500" /> ASET (Harta)</h3>
          <div className="space-y-3">
            {[
              { label: 'Kas Tunai (dari Penjualan)', value: kasTotal, sub: 'Akumulasi transaksi tunai' },
              { label: 'Nilai Stok Barang', value: nilaiStok, sub: `${(products || []).length} jenis produk` },
              { label: 'Piutang / Kasbon', value: totalPiutang, sub: `${(receivables || []).filter(r => r.status === 'ACTIVE').length} pelanggan aktif` },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-start p-3 bg-blue-50/50 rounded-xl">
                <div><p className="text-sm font-medium text-gray-800">{row.label}</p><p className="text-xs text-gray-500">{row.sub}</p></div>
                <p className="text-sm font-bold text-blue-700">{formatRupiah(row.value)}</p>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="font-bold text-gray-800">Total Aset</span>
              <span className="font-bold text-blue-700 text-lg">{formatRupiah(totalAset)}</span>
            </div>
          </div>
        </div>

        {/* KEWAJIBAN + EKUITAS */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Scale className="w-4 h-4 text-red-500" /> KEWAJIBAN & EKUITAS</h3>
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Kewajiban (Hutang)</p>
            <div className="flex justify-between items-start p-3 bg-red-50/50 rounded-xl">
              <div><p className="text-sm font-medium text-gray-800">Hutang Supplier</p><p className="text-xs text-gray-500">{(debts || []).filter(d => d.status !== 'PAID').length} tagihan belum lunas</p></div>
              <p className="text-sm font-bold text-red-700">{formatRupiah(totalHutang)}</p>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Ekuitas (Modal)</p>
            <div className="flex justify-between items-start p-3 bg-green-50/50 rounded-xl">
              <div><p className="text-sm font-medium text-gray-800">Modal Pemilik (Ekuitas Bersih)</p><p className="text-xs text-gray-500">Aset dikurangi Kewajiban</p></div>
              <p className={`text-sm font-bold ${ekuitas >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatRupiah(ekuitas)}</p>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="font-bold text-gray-800">Total Kewajiban + Ekuitas</span>
              <span className="font-bold text-gray-800 text-lg">{formatRupiah(totalHutang + ekuitas)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: BUKU BESAR (General Ledger)
// ─────────────────────────────────────────────────────────────────────────────
const TabBukuBesar = ({ transactions, expenses, timeRange }) => {
  // Generate jurnal otomatis dari transaksi & pengeluaran
  const entries = useMemo(() => {
    const rows = []
    let refNum = 1

    ;(transactions || []).forEach(trx => {
      const ref = `TRX-${String(refNum++).padStart(4, '0')}`
      const accountName = trx.payment_method === 'QRIS' ? 'Kas QRIS' : 'Kas Tunai'
      rows.push({
        timestamp: trx.timestamp, ref,
        account: accountName, description: `Penjualan - ${(trx.items || []).map(i => i.nama).join(', ').substring(0, 40)}`,
        debet: trx.total, kredit: 0,
      })
      rows.push({
        timestamp: trx.timestamp, ref,
        account: 'Pendapatan Penjualan', description: `Pendapatan dari ${ref}`,
        debet: 0, kredit: trx.total,
      })
    })

    ;(expenses || []).forEach(exp => {
      const ref = `EXP-${String(refNum++).padStart(4, '0')}`
      rows.push({
        timestamp: exp.timestamp, ref,
        account: 'Beban Operasional', description: exp.description,
        debet: exp.amount, kredit: 0,
      })
      rows.push({
        timestamp: exp.timestamp, ref,
        account: 'Kas', description: `Pembayaran ${exp.description}`,
        debet: 0, kredit: exp.amount,
      })
    })

    return rows.sort((a, b) => b.timestamp - a.timestamp)
  }, [transactions, expenses])

  const totalDebet = entries.reduce((s, e) => s + e.debet, 0)
  const totalKredit = entries.reduce((s, e) => s + e.kredit, 0)
  const totalQRIS = entries.filter(e => e.account === 'Kas QRIS').reduce((s, e) => s + e.debet, 0)
  const totalTunaiDebet = entries.filter(e => e.account === 'Kas Tunai').reduce((s, e) => s + e.debet, 0)

  const handleExport = () => {
    exportCSV(
      ['Waktu', 'No. Ref', 'Akun', 'Keterangan', 'Debet (Rp)', 'Kredit (Rp)'],
      entries.map(e => [
        new Date(e.timestamp).toLocaleString('id-ID'),
        e.ref, e.account, `"${e.description}"`, e.debet, e.kredit
      ]),
      `buku-besar-${timeRange.replace(/ /g, '-')}.csv`
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800">Jurnal Umum & Buku Besar</h3>
            <p className="text-xs text-gray-500 mt-0.5">Sistem Double-Entry Bookkeeping — dihasilkan otomatis</p>
          </div>
          {(totalTunaiDebet > 0 || totalQRIS > 0) && (
            <div className="flex gap-3 border-l border-gray-200 pl-5">
              <span className="bg-green-50 text-green-700 px-4 py-1.5 rounded-xl text-sm font-bold border border-green-200 shadow-sm flex items-center gap-1.5">
                <span className="text-xs font-semibold opacity-80">Tunai:</span> {formatRupiah(totalTunaiDebet)}
              </span>
              <span className="bg-purple-50 text-purple-700 px-4 py-1.5 rounded-xl text-sm font-bold border border-purple-200 shadow-sm flex items-center gap-1.5">
                <span className="text-xs font-semibold opacity-80">QRIS:</span> {formatRupiah(totalQRIS)}
              </span>
            </div>
          )}
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" /> Ekspor CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        {entries.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto opacity-20 mb-3" />
            <p>Belum ada jurnal untuk periode ini.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                <th className="px-4 py-3 text-left font-semibold">No. Ref</th>
                <th className="px-4 py-3 text-left font-semibold">Akun</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                <th className="px-4 py-3 text-right font-semibold text-blue-600">Debet</th>
                <th className="px-4 py-3 text-right font-semibold text-purple-600">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{new Date(e.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{e.ref}</span></td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.account}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{e.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">{e.debet > 0 ? formatRupiah(e.debet) : '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-purple-700">{e.kredit > 0 ? formatRupiah(e.kredit) : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={4} className="px-4 py-3 text-gray-700">TOTAL</td>
                <td className="px-4 py-3 text-right text-blue-700">{formatRupiah(totalDebet)}</td>
                <td className="px-4 py-3 text-right text-purple-700">{formatRupiah(totalKredit)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: HUTANG SUPPLIER (Accounts Payable)
// ─────────────────────────────────────────────────────────────────────────────
const TabHutang = ({ debts, refetch }) => {
  const [form, setForm] = useState({ supplier_name: '', description: '', amount: '', due_date: '' })
  const [showForm, setShowForm] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.supplier_name || !form.amount || !form.due_date) return
    await db.debts.add({
      supplier_name: form.supplier_name,
      description: form.description,
      amount: parseInt(form.amount),
      paid_amount: 0,
      due_date: new Date(form.due_date).getTime(),
      status: 'UNPAID',
      created_at: Date.now()
    })
    setForm({ supplier_name: '', description: '', amount: '', due_date: '' })
    setShowForm(false)
  }

  const handlePay = async (debt) => {
    const cicilan = prompt(`Masukkan jumlah pembayaran untuk "${debt.supplier_name}" (sisa: ${formatRupiah(debt.amount - (debt.paid_amount || 0))}):`)
    if (!cicilan || isNaN(cicilan)) return
    const newPaid = (debt.paid_amount || 0) + parseInt(cicilan)
    const newStatus = newPaid >= debt.amount ? 'PAID' : 'PARTIAL'
    await db.debts.update(debt.id, { paid_amount: newPaid, status: newStatus })
  }

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus tagihan ini?')) await db.debts.delete(id)
  }

  const unpaid = (debts || []).filter(d => d.status !== 'PAID')
  const paid = (debts || []).filter(d => d.status === 'PAID')
  const totalTagihan = unpaid.reduce((s, d) => s + (d.amount - (d.paid_amount || 0)), 0)

  return (
    <div className="space-y-5">
      {/* Summary + Tombol Tambah */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-2 bg-red-100 rounded-xl"><AlertCircle className="w-5 h-5 text-red-600" /></div>
          <div>
            <p className="text-xs text-red-600 font-medium">Total Hutang Belum Lunas</p>
            <p className="text-xl font-bold text-red-700">{formatRupiah(totalTagihan)}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-3 rounded-xl font-medium text-sm transition-colors shrink-0">
          <Plus className="w-4 h-4" /> Catat Hutang Baru
        </button>
      </div>

      {/* Form Tambah */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4">Catat Tagihan Baru</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Nama Supplier *</label>
              <input type="text" required value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} placeholder="Contoh: Distributor Unilever" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Keterangan Barang</label>
              <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Contoh: Sabun, Shampoo, Mie" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Total Tagihan (Rp) *</label>
              <input type="number" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="500000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Jatuh Tempo *</label>
              <input type="date" required value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Simpan</button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabel Hutang Belum Lunas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h4 className="font-bold text-gray-800">Tagihan Belum Lunas ({unpaid.length})</h4>
        </div>
        {unpaid.length === 0 ? (
          <div className="py-12 text-center text-gray-400"><CheckCircle className="w-10 h-10 mx-auto opacity-20 mb-2" /><p className="text-sm">Tidak ada hutang aktif. 🎉</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {unpaid.map(debt => {
              const dueDays = getDueDays(debt.due_date)
              const { label, cls } = getDueStyle(dueDays)
              const sisa = debt.amount - (debt.paid_amount || 0)
              const progress = debt.amount > 0 ? ((debt.paid_amount || 0) / debt.amount) * 100 : 0
              return (
                <div key={debt.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{debt.supplier_name}</p>
                      {debt.description && <p className="text-xs text-gray-500 mt-0.5">{debt.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full mb-2 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500">Sudah: {formatRupiah(debt.paid_amount || 0)} | </span>
                      <span className="text-xs font-bold text-red-600">Sisa: {formatRupiah(sisa)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handlePay(debt)} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-medium transition-colors">Bayar Cicilan</button>
                      <button onClick={() => handleDelete(debt.id)} className="text-gray-400 hover:text-red-500 p-1 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Hutang Lunas */}
      {paid.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-green-50/50">
            <h4 className="font-bold text-gray-800">Hutang Lunas ({paid.length})</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {paid.map(debt => (
              <div key={debt.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 line-through">{debt.supplier_name}</p>
                  <p className="text-xs text-gray-400">{formatRupiah(debt.amount)} — Lunas</p>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <button onClick={() => handleDelete(debt.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PIUTANG / KASBON (Accounts Receivable)
// ─────────────────────────────────────────────────────────────────────────────
const TabPiutang = ({ receivables }) => {
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', amount: '', credit_limit: '' })
  const [showForm, setShowForm] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.customer_name || !form.amount) return
    // Cek apakah pelanggan sudah ada
    const existing = (receivables || []).find(r => r.customer_name.toLowerCase() === form.customer_name.toLowerCase() && r.status === 'ACTIVE')
    if (existing) {
      // Tambah ke hutang yang ada
      await db.receivables.update(existing.id, {
        amount: existing.amount + parseInt(form.amount),
        last_updated: Date.now()
      })
    } else {
      await db.receivables.add({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        amount: parseInt(form.amount),
        credit_limit: form.credit_limit ? parseInt(form.credit_limit) : 0,
        last_updated: Date.now(),
        status: 'ACTIVE'
      })
    }
    setForm({ customer_name: '', customer_phone: '', amount: '', credit_limit: '' })
    setShowForm(false)
  }

  const handleSettle = async (r) => {
    const lunas = window.confirm(`Tandai kasbon "${r.customer_name}" sebesar ${formatRupiah(r.amount)} sebagai LUNAS?`)
    if (lunas) await db.receivables.update(r.id, { status: 'SETTLED', last_updated: Date.now() })
  }

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus data kasbon ini?')) await db.receivables.delete(id)
  }

  const handleWA = (r) => {
    if (!r.customer_phone) { alert('Nomor HP pelanggan belum diisi.'); return }
    const msg = encodeURIComponent(`Halo ${r.customer_name}, saldo kasbon Anda di Toko Podjok saat ini sebesar ${formatRupiah(r.amount)}. Mohon segera dilunasi. Terima kasih.`)
    window.open(`https://wa.me/62${r.customer_phone.replace(/^0/, '')}?text=${msg}`, '_blank')
  }

  const active = (receivables || []).filter(r => r.status === 'ACTIVE')
  const settled = (receivables || []).filter(r => r.status === 'SETTLED')
  const totalPiutang = active.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-5">
      {/* Summary + Tambah */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-2 bg-amber-100 rounded-xl"><Users className="w-5 h-5 text-amber-600" /></div>
          <div>
            <p className="text-xs text-amber-600 font-medium">Total Kasbon Aktif ({active.length} pelanggan)</p>
            <p className="text-xl font-bold text-amber-700">{formatRupiah(totalPiutang)}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-3 rounded-xl font-medium text-sm transition-colors shrink-0">
          <Plus className="w-4 h-4" /> Tambah Kasbon
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4">Catat Kasbon Baru</h4>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Nama Pelanggan *</label>
              <input type="text" required value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} placeholder="Contoh: Pak Budi" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">No HP (untuk kirim WA)</label>
              <input type="text" value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} placeholder="08123456789" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Kasbon (Rp) *</label>
              <input type="number" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="50000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Batas Limit Kasbon (Rp, opsional)</label>
              <input type="number" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} placeholder="200000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Simpan</button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Daftar Kasbon Aktif */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h4 className="font-bold text-gray-800">Kasbon Aktif ({active.length})</h4>
        </div>
        {active.length === 0 ? (
          <div className="py-12 text-center text-gray-400"><Users className="w-10 h-10 mx-auto opacity-20 mb-2" /><p className="text-sm">Tidak ada kasbon aktif saat ini.</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {active.map(r => {
              const pct = r.credit_limit > 0 ? Math.min(100, (r.amount / r.credit_limit) * 100) : 0
              const isOverLimit = r.credit_limit > 0 && r.amount >= r.credit_limit
              return (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{r.customer_name}</p>
                      {r.customer_phone && <p className="text-xs text-gray-500">{r.customer_phone}</p>}
                    </div>
                    <p className={`text-lg font-bold ${isOverLimit ? 'text-red-600' : 'text-amber-700'}`}>{formatRupiah(r.amount)}</p>
                  </div>
                  {r.credit_limit > 0 && (
                    <div className="mb-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className={`text-xs mt-1 ${isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                        {isOverLimit ? '⚠️ Melebihi limit!' : `Limit: ${formatRupiah(r.amount)} / ${formatRupiah(r.credit_limit)}`}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handleWA(r)} className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1 rounded-lg font-medium transition-colors"><PhoneCall className="w-3 h-3" /> Kirim WA</button>
                    <button onClick={() => handleSettle(r)} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-medium transition-colors">Tandai Lunas</button>
                    <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-500 p-1 transition-colors ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Kasbon Lunas */}
      {settled.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-green-50/50">
            <h4 className="font-bold text-gray-800">Kasbon Lunas ({settled.length})</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {settled.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 line-through">{r.customer_name} — {formatRupiah(r.amount)}</p>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: REKONSILIASI KAS (Tutup Kasir)
// ─────────────────────────────────────────────────────────────────────────────
const TabRekonsiliasi = ({ transactions, reconciliations }) => {
  const [physicalCash, setPhysicalCash] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Total kas sistem dari transaksi Tunai hari ini
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const kasSystem = (transactions || [])
    .filter(t => (t.payment_method === 'Tunai' || !t.payment_method) && t.timestamp >= today.getTime())
    .reduce((s, t) => s + t.total, 0)

  const physical = parseFloat(physicalCash) || 0
  const selisih = physical - kasSystem
  const isOver = selisih > 0
  const isEqual = selisih === 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!physicalCash) return
    if (selisih !== 0 && !note.trim()) { alert('Harap isi keterangan jika ada selisih.'); return }
    setIsSubmitting(true)
    try {
      await db.cash_reconciliation.add({
        timestamp: Date.now(),
        shift_id: null,
        system_balance: kasSystem,
        physical_balance: physical,
        difference: selisih,
        note: note || 'Tidak ada selisih',
      })
      setPhysicalCash('')
      setNote('')
      alert('Rekonsiliasi berhasil dicatat!')
    } catch (err) {
      alert('Gagal menyimpan rekonsiliasi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const exportRekonsiliasi = () => {
    exportCSV(
      ['Waktu', 'Kas Sistem (Rp)', 'Kas Fisik (Rp)', 'Selisih (Rp)', 'Keterangan'],
      (reconciliations || []).map(r => [
        new Date(r.timestamp).toLocaleString('id-ID'),
        r.system_balance, r.physical_balance, r.difference, `"${r.note}"`
      ]),
      'rekonsiliasi-kas.csv'
    )
  }

  return (
    <div className="space-y-6">
      {/* Panel Rekonsiliasi Hari Ini */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saldo Sistem */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4">Saldo Menurut Sistem</h3>
          <div className="p-4 bg-blue-50 rounded-xl text-center mb-4">
            <p className="text-xs text-blue-600 font-medium mb-1">Total Kas Tunai Hari Ini</p>
            <p className="text-3xl font-bold text-blue-700">{formatRupiah(kasSystem)}</p>
          </div>
          <p className="text-xs text-gray-400 text-center">Dijumlahkan otomatis dari {(transactions || []).filter(t => (t.payment_method === 'Tunai' || !t.payment_method) && t.timestamp >= today.getTime()).length} transaksi tunai hari ini.</p>
        </div>

        {/* Form Hitung Fisik */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4">Hitung Uang Fisik</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Total Uang di Laci Kasir (Rp)</label>
              <input type="number" value={physicalCash} onChange={e => setPhysicalCash(e.target.value)} placeholder="Masukkan hasil hitungan uang fisik..." className="w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none" />
            </div>

            {/* Preview Selisih */}
            {physicalCash && (
              <div className={`p-3 rounded-xl border ${isEqual ? 'bg-green-50 border-green-200' : isOver ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-semibold ${isEqual ? 'text-green-700' : isOver ? 'text-blue-700' : 'text-red-700'}`}>
                    {isEqual ? '✅ Saldo Pas!' : isOver ? '⬆️ Kelebihan' : '⬇️ Kekurangan'}
                  </span>
                  <span className={`text-lg font-bold ${isEqual ? 'text-green-700' : isOver ? 'text-blue-700' : 'text-red-700'}`}>
                    {isEqual ? formatRupiah(0) : `${isOver ? '+' : '-'}${formatRupiah(Math.abs(selisih))}`}
                  </span>
                </div>
              </div>
            )}

            {physicalCash && !isEqual && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan Selisih *</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder='Contoh: "Kembalian lebih", "Uang palsu"' className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            )}
            <button type="submit" disabled={isSubmitting || !physicalCash} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl transition-colors">
              {isSubmitting ? 'Menyimpan...' : 'Simpan Rekonsiliasi'}
            </button>
          </form>
        </div>
      </div>

      {/* Riwayat Rekonsiliasi */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h4 className="font-bold text-gray-800">Riwayat Tutup Kasir</h4>
          {(reconciliations || []).length > 0 && (
            <button onClick={exportRekonsiliasi} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" /> Ekspor CSV
            </button>
          )}
        </div>
        {!reconciliations || reconciliations.length === 0 ? (
          <div className="py-12 text-center text-gray-400"><Activity className="w-10 h-10 mx-auto opacity-20 mb-2" /><p className="text-sm">Belum ada riwayat rekonsiliasi.</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-semibold">Waktu</th>
                <th className="px-4 py-3 text-right font-semibold">Kas Sistem</th>
                <th className="px-4 py-3 text-right font-semibold">Kas Fisik</th>
                <th className="px-4 py-3 text-right font-semibold">Selisih</th>
                <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {(reconciliations || []).slice().reverse().map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatTanggalSingkat(r.timestamp)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatRupiah(r.system_balance)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatRupiah(r.physical_balance)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${r.difference === 0 ? 'text-green-600' : r.difference > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {r.difference === 0 ? 'Pas' : `${r.difference > 0 ? '+' : ''}${formatRupiah(r.difference)}`}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KOMPONEN UTAMA: PEMBUKUAN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'laba-rugi', label: 'Laba Rugi', icon: TrendingUp },
  { id: 'neraca', label: 'Neraca', icon: Scale },
  { id: 'buku-besar', label: 'Buku Besar', icon: BookOpen },
  { id: 'hutang', label: 'Hutang', icon: AlertCircle },
  { id: 'piutang', label: 'Kasbon', icon: Users },
  { id: 'rekonsiliasi', label: 'Tutup Kasir', icon: Activity },
]

const PembukuanPage = () => {
  const [activeTab, setActiveTab] = useState('laba-rugi')
  const [timeRange, setTimeRange] = useState('Bulan Ini')

  const { start, end, useBetween } = getRange(timeRange)

  // Data transaksi & pengeluaran (difilter oleh timeRange)
  const transactions = useLiveQuery(
    () => useBetween
      ? db.transactions.where('timestamp').between(start, end).reverse().toArray()
      : db.transactions.orderBy('timestamp').reverse().toArray(),
    [timeRange]
  )

  // Semua transaksi (untuk MoM)
  const allTransactions = useLiveQuery(() => db.transactions.orderBy('timestamp').toArray(), [])

  const expenses = useLiveQuery(
    () => useBetween
      ? db.expenses.where('timestamp').between(start, end).reverse().toArray()
      : db.expenses.orderBy('timestamp').reverse().toArray(),
    [timeRange]
  )

  // Data yang tidak bergantung pada filter waktu
  const products = useLiveQuery(() => db.products.toArray(), [])
  const debts = useLiveQuery(() => db.debts.orderBy('due_date').toArray(), [])
  const receivables = useLiveQuery(() => db.receivables.orderBy('last_updated').reverse().toArray(), [])
  const reconciliations = useLiveQuery(() => db.cash_reconciliation.orderBy('timestamp').toArray(), [])

  // Badge count untuk tab operasional
  const hutangCount = (debts || []).filter(d => d.status !== 'PAID').length
  const piutangCount = (receivables || []).filter(r => r.status === 'ACTIVE').length

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 lg:px-8 pt-6 pb-0 sticky top-0 z-10 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pembukuan</h1>
            <p className="text-gray-500 text-sm mt-0.5">Laporan keuangan & manajemen kas — <span className="font-medium text-gray-700">{timeRange}</span></p>
          </div>
          {/* Filter hanya tampil di tab laporan */}
          {['laba-rugi', 'buku-besar'].includes(activeTab) && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 shadow-sm self-start sm:self-auto">
              <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
              <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer">
                {TIME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <nav className="flex gap-1 overflow-x-auto pb-0 no-scrollbar">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const badge = tab.id === 'hutang' ? hutangCount : tab.id === 'piutang' ? piutangCount : 0
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all relative ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{badge}</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── KONTEN TAB ──────────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        {activeTab === 'laba-rugi' && (
          <TabLabaRugi transactions={transactions} expenses={expenses} allTransactions={allTransactions} timeRange={timeRange} />
        )}
        {activeTab === 'neraca' && (
          <TabNeraca transactions={allTransactions} debts={debts} receivables={receivables} products={products} />
        )}
        {activeTab === 'buku-besar' && (
          <TabBukuBesar transactions={transactions} expenses={expenses} timeRange={timeRange} />
        )}
        {activeTab === 'hutang' && (
          <TabHutang debts={debts} />
        )}
        {activeTab === 'piutang' && (
          <TabPiutang receivables={receivables} />
        )}
        {activeTab === 'rekonsiliasi' && (
          <TabRekonsiliasi transactions={allTransactions} reconciliations={reconciliations} />
        )}
      </div>
    </div>
  )
}

export default PembukuanPage
