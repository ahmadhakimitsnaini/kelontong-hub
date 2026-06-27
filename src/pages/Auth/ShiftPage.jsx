import React, { useState } from 'react'
import { Clock, Play, Square, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../../db/db'
import { formatRupiah, formatTanggal } from '../../lib/utils'

const ShiftPage = () => {
  // ── 1. AMBIL STATUS SHIFT TERAKHIR DARI DATABASE ──────────────────────────
  const activeShift = useLiveQuery(async () => {
    // Ambil shift terbaru (terakhir di-insert)
    const shifts = await db.shifts.orderBy('id').reverse().toArray()
    return shifts[0] // Ambil urutan pertama
  })

  // Apakah shift terakhir belum ditutup?
  const isShiftActive = activeShift && !activeShift.waktu_selesai

  // ── 2. STATE UNTUK BUKA SHIFT ──────────────────────────────────────────────
  const [bukaShiftForm, setBukaShiftForm] = useState({ nama_kasir: '', saldo_awal: '' })

  const handleBukaShift = async (e) => {
    e.preventDefault()
    if (!bukaShiftForm.nama_kasir || !bukaShiftForm.saldo_awal) return

    try {
      await db.shifts.add({
        nama_kasir: bukaShiftForm.nama_kasir,
        saldo_awal: parseInt(bukaShiftForm.saldo_awal),
        waktu_mulai: new Date().getTime(),
        waktu_selesai: null,
        saldo_akhir: null,
        selisih: null
      })
      setBukaShiftForm({ nama_kasir: '', saldo_awal: '' })
    } catch (error) {
      alert('Gagal membuka shift.')
      console.error(error)
    }
  }

  // ── 3. STATE & KALKULASI UNTUK TUTUP SHIFT ───────────────────────────────
  // Ambil transaksi & pengeluaran yang terjadi SELAMA shift ini berlangsung
  const shiftTransactions = useLiveQuery(() => {
    if (!isShiftActive) return []
    return db.transactions.where('timestamp').aboveOrEqual(activeShift.waktu_mulai).toArray()
  }, [isShiftActive, activeShift?.waktu_mulai])

  const shiftExpenses = useLiveQuery(() => {
    if (!isShiftActive) return []
    return db.expenses.where('timestamp').aboveOrEqual(activeShift.waktu_mulai).toArray()
  }, [isShiftActive, activeShift?.waktu_mulai])

  // Hitung Estimasi Saldo Sistem
  let totalPenjualan = 0
  if (shiftTransactions) {
    shiftTransactions.forEach(t => totalPenjualan += t.total)
  }

  let totalPengeluaran = 0
  if (shiftExpenses) {
    shiftExpenses.forEach(e => totalPengeluaran += e.amount)
  }

  const saldoSistem = (activeShift?.saldo_awal || 0) + totalPenjualan - totalPengeluaran

  // State Input Saldo Laci (Fisik) saat tutup
  const [saldoAkhirFisik, setSaldoAkhirFisik] = useState('')
  const selisih = parseInt(saldoAkhirFisik || 0) - saldoSistem

  const handleTutupShift = async (e) => {
    e.preventDefault()
    if (saldoAkhirFisik === '') return

    if (window.confirm("Apakah uang di laci sudah dihitung dengan benar? Shift akan dikunci.")) {
      try {
        await db.shifts.update(activeShift.id, {
          waktu_selesai: new Date().getTime(),
          saldo_akhir: parseInt(saldoAkhirFisik),
          selisih: selisih
        })
        setSaldoAkhirFisik('')
      } catch (error) {
        alert('Gagal menutup shift.')
        console.error(error)
      }
    }
  }

  // ── 4. RIWAYAT SHIFT SEBELUMNYA ────────────────────────────────────────────
  const shiftHistory = useLiveQuery(() => db.shifts.orderBy('id').reverse().toArray())

  // ── RENDER ANTARMUKA ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-auto p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Shift</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola serah terima laci kasir untuk menghindari selisih uang.</p>
      </div>

      {/* ── PANEL UTAMA (BUKA / TUTUP SHIFT) ──────────────────────────────── */}
      {!isShiftActive ? (
        
        /* ── LAYAR BUKA SHIFT ── */
        <div className="bg-surface p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Play className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Buka Shift Baru</h2>
              <p className="text-gray-500 text-sm">Masukkan uang receh/modal ke laci sebelum mulai berjualan.</p>
            </div>
          </div>
          
          <form onSubmit={handleBukaShift} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Kasir / Staff</label>
              <input 
                required type="text" 
                value={bukaShiftForm.nama_kasir} 
                onChange={(e) => setBukaShiftForm({...bukaShiftForm, nama_kasir: e.target.value})}
                placeholder="Contoh: Budi"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Uang Modal Awal di Laci (Rp)</label>
              <input 
                required type="number" 
                value={bukaShiftForm.saldo_awal} 
                onChange={(e) => setBukaShiftForm({...bukaShiftForm, saldo_awal: e.target.value})}
                placeholder="Contoh: 100000"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all font-semibold" 
              />
            </div>
            <button type="submit" className="w-full py-3.5 mt-2 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95 flex justify-center items-center gap-2">
              <Clock className="w-5 h-5" /> MULAI BERJUALAN
            </button>
          </form>
        </div>

      ) : (

        /* ── LAYAR TUTUP SHIFT ── */
        <div className="bg-surface p-6 md:p-8 rounded-2xl shadow-md border border-red-100 max-w-2xl relative overflow-hidden">
          {/* Aksen Merah */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500"></div>

          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <Square className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Tutup Shift: {activeShift.nama_kasir}</h2>
              <p className="text-gray-500 text-sm">Dimulai sejak: {new Date(activeShift.waktu_mulai).toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1">Modal Awal</p>
              <p className="text-lg font-bold text-gray-800">{formatRupiah(activeShift.saldo_awal)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1">Total Penjualan Shift</p>
              <p className="text-lg font-bold text-green-600">+{formatRupiah(totalPenjualan)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1">Pengeluaran Kas Shift</p>
              <p className="text-lg font-bold text-red-600">-{formatRupiah(totalPengeluaran)}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
              <p className="text-xs text-blue-600 font-bold mb-1">ESTIMASI SALDO SISTEM</p>
              <p className="text-xl font-bold text-blue-900">{formatRupiah(saldoSistem)}</p>
            </div>
          </div>

          <form onSubmit={handleTutupShift}>
            <label className="block text-sm font-bold text-gray-800 mb-2">Hitung Uang Fisik Laci Saat Ini (Rp)</label>
            <input 
              required type="number" 
              value={saldoAkhirFisik}
              onChange={(e) => setSaldoAkhirFisik(e.target.value)}
              placeholder="Masukkan total uang lembaran yang ada di laci..."
              className="w-full px-4 py-4 text-xl bg-white border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-0 transition-all font-bold mb-3" 
            />
            
            {/* Indikator Selisih */}
            {saldoAkhirFisik !== '' && (
              <div className={`p-4 rounded-xl flex items-center gap-3 mb-6 border ${
                selisih === 0 ? 'bg-green-50 border-green-200 text-green-700' : 
                selisih < 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
              }`}>
                {selisih === 0 && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                {selisih < 0 && <XCircle className="w-6 h-6 text-red-500" />}
                {selisih > 0 && <AlertCircle className="w-6 h-6 text-yellow-500" />}
                
                <div>
                  <p className="font-bold text-sm">
                    {selisih === 0 ? 'UANG PAS (BALANCE)' : 
                     selisih < 0 ? 'UANG KURANG (MINUS)' : 'UANG BERLEBIH'}
                  </p>
                  <p className="text-lg font-black">{formatRupiah(Math.abs(selisih))}</p>
                </div>
              </div>
            )}

            <button type="submit" className="w-full py-4 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-lg">
              AKHIRI SHIFT SEKARANG
            </button>
          </form>
        </div>
      )}

      {/* ── RIWAYAT SHIFT (TABEL) ────────────────────────────────────────── */}
      <div className="bg-surface p-6 rounded-2xl shadow-sm border border-gray-100 flex-1 mt-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Riwayat Serah Terima Laci</h3>
        
        <div className="overflow-x-auto">
          {!shiftHistory || shiftHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Belum ada riwayat shift.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-sm text-gray-500">
                  <th className="pb-3 font-medium whitespace-nowrap">Status/Tanggal</th>
                  <th className="pb-3 font-medium">Kasir</th>
                  <th className="pb-3 font-medium text-right">Modal Awal</th>
                  <th className="pb-3 font-medium text-right">Saldo Sistem</th>
                  <th className="pb-3 font-medium text-right">Fisik Laci</th>
                  <th className="pb-3 font-medium text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {shiftHistory.map(shift => (
                  <tr key={shift.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 text-sm">
                      {!shift.waktu_selesai ? (
                         <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">AKTIF</span>
                      ) : (
                        <span className="text-gray-600">{new Date(shift.waktu_selesai).toLocaleDateString()}</span>
                      )}
                    </td>
                    <td className="py-3 text-sm font-semibold text-gray-800">{shift.nama_kasir}</td>
                    <td className="py-3 text-sm text-right">{formatRupiah(shift.saldo_awal)}</td>
                    
                    {/* Jika masih aktif, jangan tampilkan laporan selisih */}
                    {!shift.waktu_selesai ? (
                      <td colSpan="3" className="py-3 text-sm text-center text-gray-400 italic">Sedang Berjalan...</td>
                    ) : (
                      <>
                        <td className="py-3 text-sm text-right text-gray-600">{formatRupiah(shift.saldo_akhir - shift.selisih)}</td>
                        <td className="py-3 text-sm text-right font-semibold text-gray-900">{formatRupiah(shift.saldo_akhir)}</td>
                        <td className={`py-3 text-sm text-right font-bold ${
                          shift.selisih === 0 ? 'text-green-600' : 
                          shift.selisih < 0 ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {shift.selisih > 0 ? '+' : ''}{formatRupiah(shift.selisih)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  )
}

export default ShiftPage
