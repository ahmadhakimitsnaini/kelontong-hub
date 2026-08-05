import React, { useState } from 'react';
import { X, CheckCircle, Wallet, Banknote } from 'lucide-react';
import { formatRupiah, formatRibuan } from '../../lib/utils';
import useNotificationStore from '../../store/useNotificationStore';

const PaymentModal = ({ isOpen, onClose, totalHarga, onCheckout }) => {
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [amountPaid, setAmountPaid] = useState('');

  if (!isOpen) return null;

  const handleProcess = () => {
    const paid = Number(amountPaid) || 0;
    if (paymentMethod === 'Tunai' && paid < totalHarga) {
      useNotificationStore.getState().showAlert("Jumlah uang tunai kurang dari total tagihan!", "error");
      return;
    }
    // Lanjutkan proses ke POSPage
    onCheckout(paymentMethod, paid);
    
    // Reset internal state for next time
    setAmountPaid('');
    setPaymentMethod('Tunai');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">Detail Pembayaran</h2>
          <button 
            onClick={onClose}
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
            onClick={handleProcess}
            className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Selesaikan Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PaymentModal);
