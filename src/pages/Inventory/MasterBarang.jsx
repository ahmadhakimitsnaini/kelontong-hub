import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Search, Plus, ArrowLeft, Save, Edit, Trash2, Camera } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../../db/db';
import useNotificationStore from '../../store/useNotificationStore';
import DualImageUploader from './DualImageUploader';

import { formatRupiah, formatRibuan } from '../../lib/utils';

const MasterBarang = () => {
  const { showAlert } = useNotificationStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    nama: "",
    barcode: "",
    kategori: "",
    deskripsi: "",
    harga_beli: "",
    harga_jual: "",
    images: []
  });

  // ── Fase 3: Tangkap barcode dari URL parameter (dari Scanner mode PRODUK_BARU) ──
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const barcodeFromScanner = searchParams.get('barcode');
    if (barcodeFromScanner) {
      // Buka form dan isi field barcode secara otomatis
      setFormData(prev => ({ ...prev, barcode: barcodeFromScanner }));
      setIsFormOpen(true);
      // Bersihkan URL agar tidak ter-trigger ulang saat navigasi
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const products = useLiveQuery(() => {
    if (searchQuery) {
      return db.products
        .filter(p => p.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())))
        .reverse()
        .toArray();
    }
    return db.products.orderBy("id").reverse().toArray();
  }, [searchQuery]);

  const resetForm = () => {
    setFormData({
      nama: "",
      barcode: "",
      kategori: "",
      deskripsi: "",
      harga_beli: "",
      harga_jual: "",
      images: []
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleEdit = (product) => {
    setFormData({
      nama: product.nama || "",
      barcode: product.barcode || "",
      kategori: product.kategori || "",
      deskripsi: product.deskripsi || "",
      harga_beli: product.harga_beli || "",
      harga_jual: product.harga_jual || "",
      images: product.images || []
    });
    setEditingId(product.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus SKU produk ini?")) {
      try {
        await db.products.delete(id);
        showAlert("Produk berhasil dihapus", "success");
      } catch (error) {
        showAlert("Gagal menghapus produk", "error");
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nama || !formData.harga_beli || !formData.harga_jual) {
      showAlert("Nama dan Harga (Pokok & Konsumen) wajib diisi!", "error");
      return;
    }

    try {
      const payload = {
        nama: formData.nama,
        barcode: formData.barcode,
        kategori: formData.kategori,
        deskripsi: formData.deskripsi,
        harga_beli: parseInt(formData.harga_beli),
        harga_jual: parseInt(formData.harga_jual),
        images: formData.images,
        // stok dikelola oleh inbound, default 0 untuk barang baru
        stok: editingId ? undefined : 0, 
      };

      if (editingId) {
        // Hapus property undefined agar tidak menimpa stok yang sudah ada
        delete payload.stok;
        await db.products.update(editingId, payload);
        showAlert("Produk berhasil diperbarui", "success");
      } else {
        await db.products.add(payload);
        showAlert("SKU baru berhasil ditambahkan", "success");
      }
      
      resetForm();
    } catch (error) {
      console.error(error);
      showAlert("Gagal menyimpan produk", "error");
    }
  };

  // View: Tabel Katalog
  const renderTableView = () => (
    <div className="p-4 md:p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary-500" />
            Master Barang
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Katalog utama untuk mendaftarkan identitas produk (SKU).
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Tambah SKU Baru
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama atau SKU/Barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-sm text-gray-500">
                <th className="p-4 font-semibold">Info Produk</th>
                <th className="p-4 font-semibold">Harga Pokok</th>
                <th className="p-4 font-semibold">Harga Konsumen</th>
                <th className="p-4 font-semibold text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(!products || products.length === 0) ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500">
                    Belum ada produk terdaftar. Silakan klik "Tambah SKU Baru".
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {p.images && p.images[0] ? (
                            <img src={p.images[0]} alt={p.nama} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-gray-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 line-clamp-1">{p.nama}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {p.barcode ? (
                              <span className="text-[11px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                {p.barcode}
                              </span>
                            ) : (
                              <span className="text-[11px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">No SKU</span>
                            )}
                            {p.kategori && (
                              <span className="text-[11px] bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded">
                                {p.kategori}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-gray-600">{formatRupiah(p.harga_beli || 0)}</td>
                    <td className="p-4 font-bold text-gray-800">{formatRupiah(p.harga_jual || 0)}</td>
                    <td className="p-4">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // View: Form Tambah/Edit
  const renderFormView = () => (
    <form onSubmit={handleSave} className="p-4 md:p-6 max-w-3xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header Form */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={resetForm}
            className="p-2 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {editingId ? "Edit Produk" : "Tambah SKU Baru"}
            </h1>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Card 1: Informasi Produk */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-50 pb-3 mb-5">
            Informasi Produk
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                maxLength={100}
                value={formData.nama}
                onChange={(e) => setFormData({...formData, nama: e.target.value})}
                placeholder="Contoh: Indomie Goreng Spesial"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-colors"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Nomor SKU / Barcode
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                  placeholder="Scan atau ketik SKU..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-mono transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Kategori
                </label>
                <select
                  value={formData.kategori}
                  onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-colors"
                >
                  <option value="">-- Pilih Kategori --</option>
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Rokok">Rokok</option>
                  <option value="Sembako">Sembako</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Deskripsi
              </label>
              <textarea
                rows={3}
                value={formData.deskripsi}
                onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                placeholder="Catatan tambahan mengenai produk ini..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Foto Produk */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-50 pb-3 mb-5 flex items-center gap-2">
            <Camera className="w-5 h-5 text-gray-400" />
            Foto Produk
          </h2>
          <DualImageUploader 
            images={formData.images} 
            onChange={(newImages) => setFormData({...formData, images: newImages})} 
          />
        </div>

        {/* Card 3: Informasi Penjualan */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6">
          <h2 className="text-lg font-bold text-gray-800 border-b border-gray-50 pb-3 mb-5">
            Informasi Penjualan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Harga Pokok (Modal) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                <input
                  required
                  type="text"
                  value={formatRibuan(formData.harga_beli)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setFormData({...formData, harga_beli: raw ? Number(raw) : ''});
                  }}
                  placeholder="0"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-bold text-gray-800 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Harga Konsumen (Jual) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                <input
                  required
                  type="text"
                  value={formatRibuan(formData.harga_jual)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setFormData({...formData, harga_jual: raw ? Number(raw) : ''});
                  }}
                  placeholder="0"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-bold text-gray-800 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95"
          >
            <Save className="w-5 h-5" />
            Simpan SKU
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="h-full bg-background overflow-y-auto">
      {isFormOpen ? renderFormView() : renderTableView()}
    </div>
  );
};

export default MasterBarang;
