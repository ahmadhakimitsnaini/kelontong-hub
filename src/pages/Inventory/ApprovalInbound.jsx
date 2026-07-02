import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../db/db';
import { CheckCircle, XCircle, Clock, Package, AlertTriangle, Search } from 'lucide-react';
import { formatRupiah } from '../../lib/utils';
import useNotificationStore from '../../store/useNotificationStore';

const ApprovalInbound = () => {
  const { showAlert, showConfirm } = useNotificationStore();
  
  // Hanya ambil yang PENDING
  const pendingRequests = useLiveQuery(
    () => db.inbound_logs.where('status').equals('PENDING').reverse().toArray(),
    []
  );

  const handleApprove = async (log) => {
    showConfirm(`Setujui pengajuan stok ini senilai ${formatRupiah(log.total_nilai)}?`, async () => {
      try {
        await db.transaction('rw', [db.products, db.inbound_logs, db.expenses, db.debts], async () => {
          
          // 1. Eksekusi penambahan stok ke master barang
          for (const item of log.items) {
            const product = await db.products.get(item.product_id);
            if (product) {
              const newStok = (product.stok || 0) + item.qty_masuk;
              await db.products.update(product.id, { stok: newStok });
            }
          }

          // 2. Eksekusi ke pembukuan (Akuntansi)
          if (log.total_nilai > 0) {
            if (log.sumber_dana === 'Kas Tunai') {
              await db.expenses.add({
                amount: log.total_nilai,
                description: `Approve Inbound: ${log.catatan}`,
                timestamp: new Date().getTime(),
                synced: 0
              });
            } else if (log.sumber_dana === 'Hutang' && log.hutang_info) {
              await db.debts.add({
                supplier_name: log.hutang_info.supplier_name,
                description: `Approve Inbound (Hutang): ${log.catatan}`,
                amount: log.total_nilai,
                paid_amount: 0,
                due_date: log.hutang_info.due_date,
                status: 'UNPAID',
                created_at: Date.now()
              });
            }
          }

          // 3. Ubah status log menjadi APPROVED
          await db.inbound_logs.update(log.id, { status: 'APPROVED' });
        });

        showAlert('Pengajuan berhasil disetujui! Stok dan pembukuan telah diupdate.', 'success');
      } catch (error) {
        console.error("Gagal menyetujui inbound:", error);
        showAlert('Terjadi kesalahan sistem saat menyetujui pengajuan.', 'error');
      }
    });
  };

  const handleReject = async (logId) => {
    showConfirm('Tolak pengajuan stok ini? Data akan dibatalkan permanen.', async () => {
      try {
        await db.inbound_logs.update(logId, { status: 'REJECTED' });
        showAlert('Pengajuan telah ditolak.', 'success');
      } catch (error) {
        console.error("Gagal menolak:", error);
        showAlert('Terjadi kesalahan.', 'error');
      }
    });
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 animate-in fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-primary-500" />
          Persetujuan Inbound (Approval)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Validasi pengajuan stok barang dari Karyawan sebelum masuk ke rak dan pembukuan.
        </p>
      </div>

      {(!pendingRequests || pendingRequests.length === 0) ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center justify-center text-center shadow-sm">
          <CheckCircle className="w-16 h-16 text-green-200 mb-4" />
          <h3 className="text-xl font-bold text-gray-700">Semua Beres!</h3>
          <p className="text-gray-500 mt-2 max-w-md">Tidak ada pengajuan Inbound yang menunggu persetujuan Anda saat ini.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingRequests.map(req => (
            <div key={req.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              
              {/* Header Card */}
              <div className="bg-gray-50/80 border-b border-gray-100 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> MENUNGGU PERSETUJUAN
                    </span>
                    <span className="text-xs text-gray-500 font-medium">{formatDate(req.timestamp)}</span>
                  </div>
                  <h3 className="font-bold text-lg text-gray-800">Catatan: {req.catatan}</h3>
                  <p className="text-sm text-gray-500">Diajukan oleh: <strong className="text-gray-700">{req.kasir_nama}</strong></p>
                </div>
                <div className={`p-3 rounded-xl border flex flex-col items-end shrink-0 ${req.sumber_dana === 'Hutang' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Nilai Pengajuan</span>
                  <span className={`text-lg font-bold ${req.sumber_dana === 'Hutang' ? 'text-red-700' : 'text-green-700'}`}>
                    {formatRupiah(req.total_nilai)}
                  </span>
                  <span className="text-xs font-medium mt-1 bg-white px-2 py-0.5 rounded shadow-sm">
                    {req.sumber_dana === 'Hutang' ? `Hutang: ${req.hutang_info?.supplier_name}` : 'Kas Tunai'}
                  </span>
                </div>
              </div>

              {/* Rincian Barang */}
              <div className="p-4 sm:px-6 bg-white overflow-x-auto">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Daftar Barang ({req.total_sku} Jenis)</p>
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-medium">Nama Barang</th>
                      <th className="pb-2 font-medium text-center">Qty Masuk</th>
                      <th className="pb-2 font-medium text-right">Nilai Modal (HPP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {req.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2">
                          <p className="font-bold text-gray-800">{item.nama}</p>
                          <span className="text-[10px] font-mono text-gray-400">{item.barcode || '-'}</span>
                        </td>
                        <td className="py-2 text-center">
                          <span className="font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">+{item.qty_masuk}</span>
                        </td>
                        <td className="py-2 text-right font-medium text-gray-600">
                          {formatRupiah(item.subtotal_hpp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="bg-gray-50 border-t border-gray-100 p-4 sm:px-6 flex items-center justify-end gap-3">
                <button 
                  onClick={() => handleReject(req.id)}
                  className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
                >
                  <XCircle className="w-5 h-5" /> Tolak
                </button>
                <button 
                  onClick={() => handleApprove(req)}
                  className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/30 transition-all active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> Setujui & Posting
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovalInbound;
