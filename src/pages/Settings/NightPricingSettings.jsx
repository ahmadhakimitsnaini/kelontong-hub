import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../db/db';
import useSettingsStore from '../../store/useSettingsStore';
import { Moon, Save, Search, CheckCircle } from 'lucide-react';
import { formatRupiah, formatRibuan } from '../../lib/utils';

const NightPricingSettings = () => {
  const { isNightPricingActive, nightStartTime, nightEndTime, fetchSettings, updateNightSettings } = useSettingsStore();
  
  const [localActive, setLocalActive] = useState(false);
  const [localStart, setLocalStart] = useState('00:00');
  const [localEnd, setLocalEnd] = useState('06:00');
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [bulkIncrease, setBulkIncrease] = useState('');

  // Fetch settings once on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Sync local state when store updates
  useEffect(() => {
    setLocalActive(isNightPricingActive);
    setLocalStart(nightStartTime);
    setLocalEnd(nightEndTime);
  }, [isNightPricingActive, nightStartTime, nightEndTime]);

  const products = useLiveQuery(
    () => db.products.filter(p => p.nama.toLowerCase().includes(search.toLowerCase())).toArray(),
    [search]
  );

  const handleSaveSettings = async () => {
    await updateNightSettings(localActive, localStart, localEnd);
    alert('Pengaturan jam malam berhasil disimpan!');
  };

  const handleToggleSelect = (id) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products?.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products?.map(p => p.id)));
    }
  };

  const handleUpdatePrice = async (id, value) => {
    const numericValue = parseInt(value.replace(/\D/g, ''), 10);
    await db.products.update(id, { harga_malam: isNaN(numericValue) ? null : numericValue });
  };

  const handleBulkUpdate = async () => {
    if (selectedProducts.size === 0) return alert('Pilih minimal 1 produk');
    const increase = parseInt(bulkIncrease.replace(/\D/g, ''), 10);
    if (isNaN(increase)) return alert('Masukkan nominal kenaikan yang valid');

    const productsToUpdate = products.filter(p => selectedProducts.has(p.id));
    
    db.transaction('rw', db.products, async () => {
      for (const product of productsToUpdate) {
        const basePrice = product.harga_jual || 0;
        await db.products.update(product.id, { harga_malam: basePrice + increase });
      }
    }).then(() => {
      alert('Berhasil memperbarui harga malam!');
      setSelectedProducts(new Set());
      setBulkIncrease('');
    }).catch(err => {
      console.error(err);
      alert('Terjadi kesalahan saat memperbarui harga.');
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Moon className="w-6 h-6 text-indigo-600" />
          Pengaturan Tarif Malam
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Sesuaikan harga produk secara otomatis pada jam operasional malam (Night Surcharge).
        </p>
      </div>

      {/* Settings Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">Jam Operasional Tarif Malam</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status Fitur</label>
            <button
              onClick={() => setLocalActive(!localActive)}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-medium transition-colors ${
                localActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {localActive ? '🌙 Aktif' : 'Nonaktif'}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Jam Mulai</label>
            <input
              type="time"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Jam Berakhir</label>
            <input
              type="time"
              value={localEnd}
              onChange={(e) => setLocalEnd(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Save className="w-4 h-4" />
            Simpan Konfigurasi Waktu
          </button>
        </div>
      </div>

      {/* Product Management */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-800">Daftar Barang & Harga Malam</h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
            <span className="text-sm text-indigo-800 font-medium whitespace-nowrap">
              {selectedProducts.size} Produk Terpilih
            </span>
            <div className="flex-1 flex gap-2 w-full">
              <input
                type="text"
                placeholder="+ Rp Kenaikan (Cth: 1000)"
                value={bulkIncrease}
                onChange={(e) => setBulkIncrease(formatRibuan(e.target.value))}
                className="flex-1 px-4 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
              <button
                onClick={handleBulkUpdate}
                disabled={selectedProducts.size === 0 || !bulkIncrease}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                Terapkan Massal
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={products?.length > 0 && selectedProducts.size === products.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-4">Nama Produk</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Harga Normal</th>
                <th className="px-6 py-4">Harga Malam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products?.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => handleToggleSelect(product.id)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-800">{product.nama}</td>
                  <td className="px-6 py-3 text-slate-500">
                    <span className="px-2.5 py-1 bg-slate-100 rounded-full text-xs">{product.kategori}</span>
                  </td>
                  <td className="px-6 py-3 text-slate-700">{formatRupiah(product.harga_jual)}</td>
                  <td className="px-6 py-3">
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Rp</span>
                      <input
                        type="text"
                        value={product.harga_malam ? formatRibuan(product.harga_malam) : ''}
                        onChange={(e) => handleUpdatePrice(product.id, e.target.value)}
                        placeholder="Harga"
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {products?.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    Tidak ada produk ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NightPricingSettings;
