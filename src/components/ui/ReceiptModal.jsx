import React, { useRef } from 'react';
import { X, Download, CheckCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { formatRupiah } from '../../lib/utils';

/**
 * ReceiptModal — Komponen Struk Pembayaran On-Screen
 *
 * Props:
 *  - isOpen       : boolean  — Kontrol visibilitas modal
 *  - onClose      : function — Callback saat struk ditutup (juga akan clearCart)
 *  - receiptData  : object   — Data transaksi yang akan ditampilkan di struk
 *    {
 *      items         : array   — Daftar barang yang dibeli
 *      total         : number  — Total tagihan
 *      kembalian     : number  — Kembalian (0 jika bukan tunai)
 *      paymentMethod : string  — 'Tunai' | 'QRIS'
 *      amountPaid    : number  — Jumlah uang yang dibayarkan
 *      timestamp     : number  — Waktu transaksi (ms epoch)
 *    }
 */
const ReceiptModal = ({ isOpen, onClose, receiptData }) => {
  const receiptRef = useRef(null);

  if (!isOpen || !receiptData) return null;

  const {
    items = [],
    total = 0,
    kembalian = 0,
    paymentMethod = 'Tunai',
    amountPaid = 0,
    timestamp = Date.now(),
  } = receiptData;

  // Format tanggal & waktu untuk header struk
  const txDate = new Date(timestamp);
  const tanggal = txDate.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
  const waktu = txDate.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // Generate nama file PNG yang informatif
  const generateFilename = () => {
    const ts = txDate.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `Struk-MD-${ts}.png`;
  };

  // Fungsi download struk sebagai PNG menggunakan html2canvas
  const handleDownload = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Resolusi 2x agar gambar tajam
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = generateFilename();
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('[ReceiptModal] Gagal mengunduh struk:', err);
    }
  };

  return (
    /* Overlay backdrop */
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Wrapper utama modal (tidak ikut di-screenshot) */}
      <div className="relative w-full max-w-sm flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">

        {/* ── AREA STRUK (yang akan di-screenshot oleh html2canvas) ── */}
        <div
          ref={receiptRef}
          className="w-full bg-white rounded-2xl overflow-hidden font-mono text-gray-800 shadow-2xl"
          style={{ maxWidth: '340px' }}
        >
          {/* Header Toko */}
          <div className="bg-gray-900 px-6 pt-7 pb-6 text-center text-white">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
              <span className="text-gray-900 font-black text-xl">F</span>
            </div>
            <p className="font-black text-xl tracking-wide">Toko Podjok</p>
            <p className="text-gray-400 text-xs mt-1">Warung Digital Madura</p>
          </div>

          {/* Info Transaksi */}
          <div className="bg-gray-50 px-5 py-3 border-b border-dashed border-gray-200 flex justify-between text-[11px] text-gray-500">
            <span>{tanggal}</span>
            <span>{waktu}</span>
          </div>

          {/* Daftar Belanja */}
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-3">Detail Belanja</p>
            <div className="flex flex-col gap-2.5">
              {items.map((item, idx) => (
                <div key={item.id ?? idx} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-snug truncate">{item.nama}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {item.quantity} × {formatRupiah(item.harga_jual)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-700 whitespace-nowrap shrink-0">
                    {formatRupiah(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Garis Pemisah Putus-Putus */}
          <div className="mx-5 border-t-2 border-dashed border-gray-200 my-1" />

          {/* Ringkasan Pembayaran */}
          <div className="px-5 py-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-700">{formatRupiah(total)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Metode Bayar</span>
              <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                paymentMethod === 'Tunai'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {paymentMethod}
              </span>
            </div>
            {paymentMethod === 'Tunai' && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Uang Diterima</span>
                <span className="font-semibold text-gray-700">{formatRupiah(amountPaid)}</span>
              </div>
            )}
          </div>

          {/* Garis Pemisah */}
          <div className="mx-5 border-t-2 border-dashed border-gray-200" />

          {/* Total & Kembalian */}
          <div className="px-5 py-4">
            <div className="flex justify-between items-center">
              <span className="font-black text-base text-gray-900">TOTAL</span>
              <span className="font-black text-xl text-gray-900">{formatRupiah(total)}</span>
            </div>
            {paymentMethod === 'Tunai' && kembalian > 0 && (
              <div className="flex justify-between items-center mt-2 bg-green-50 rounded-xl px-3 py-2">
                <span className="text-sm font-bold text-green-700">Kembalian</span>
                <span className="text-lg font-black text-green-700">{formatRupiah(kembalian)}</span>
              </div>
            )}
          </div>

          {/* Footer Struk */}
          <div className="bg-gray-50 border-t border-dashed border-gray-200 px-5 py-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-bold text-green-600">Pembayaran Berhasil</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Terima kasih telah berbelanja!<br />
              Simpan struk ini sebagai bukti transaksi.
            </p>
          </div>
        </div>

        {/* ── TOMBOL AKSI (di luar area screenshot) ── */}
        <div className="w-full flex gap-3" style={{ maxWidth: '340px' }}>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white text-gray-800 font-bold rounded-2xl shadow-lg border border-gray-200 hover:bg-gray-50 transition-all active:scale-95"
          >
            <Download className="w-5 h-5" />
            Unduh PNG
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-500/30 transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
