import React, { useState, useMemo } from 'react';
import {
  Truck, Plus, Search, Phone, MapPin, FileText,
  Edit, Trash2, X, Save, ChevronRight, Package,
  AlertTriangle, ShoppingCart, MessageCircle, ArrowLeft,
  Users, CheckCircle, Clock
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { deleteAndSync } from '../../db/db';
import useNotificationStore from '../../store/useNotificationStore';
import useAuthStore from '../../store/useAuthStore';

// ─── Utilitas Format Rupiah ────────────────────────────────────────────────────
const formatRupiah = (num) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);

// ─── Konstanta Batas Stok Kritis ──────────────────────────────────────────────
const STOK_MINIMUM_DEFAULT = 5; // Barang dianggap "tipis" jika stok <= 5

// ─── Komponen: Modal Tambah / Edit Supplier ───────────────────────────────────
const SupplierFormModal = ({ supplier, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    nama_supplier: supplier?.nama_supplier || '',
    kontak_phone: supplier?.kontak_phone || '',
    alamat: supplier?.alamat || '',
    catatan: supplier?.catatan || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert } = useNotificationStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nama_supplier.trim()) {
      showAlert('Nama supplier wajib diisi!', 'error');
      return;
    }
    setIsLoading(true);
    try {
      if (supplier?.id) {
        await db.suppliers.update(supplier.id, {
          nama_supplier: formData.nama_supplier.trim(),
          kontak_phone: formData.kontak_phone.trim(),
          alamat: formData.alamat.trim(),
          catatan: formData.catatan.trim(),
        });
        showAlert('Data supplier berhasil diperbarui', 'success');
      } else {
        await db.suppliers.add({
          nama_supplier: formData.nama_supplier.trim(),
          kontak_phone: formData.kontak_phone.trim(),
          alamat: formData.alamat.trim(),
          catatan: formData.catatan.trim(),
        });
        showAlert('Supplier baru berhasil ditambahkan', 'success');
      }
      onSave?.();
      onClose();
    } catch (err) {
      console.error(err);
      showAlert('Gagal menyimpan data supplier', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel Form */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary-500" />
            {supplier?.id ? 'Edit Supplier' : 'Tambah Supplier Baru'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Nama Supplier */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nama Supplier / Distributor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.nama_supplier}
              onChange={(e) => setFormData({ ...formData, nama_supplier: e.target.value })}
              placeholder="Contoh: Agen Sembako H. Somad"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-colors"
            />
          </div>

          {/* Nomor HP / WA */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nomor WA / Telepon
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.kontak_phone}
                onChange={(e) => setFormData({ ...formData, kontak_phone: e.target.value })}
                placeholder="Contoh: 628123456789"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-colors"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Format: 628xxx (tanpa + atau 0 di depan) untuk tombol Chat WA</p>
          </div>

          {/* Alamat */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Alamat
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <textarea
                rows={2}
                value={formData.alamat}
                onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                placeholder="Alamat toko / gudang distributor..."
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none transition-colors"
              />
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Catatan
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <textarea
                rows={2}
                value={formData.catatan}
                onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                placeholder="Misal: Kunjungan setiap Senin pagi, Min. order 5 dus..."
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Komponen: Modal Detail / Profil Supplier ─────────────────────────────────
const SupplierDetailModal = ({ supplier, products, onClose, onEdit, onDelete }) => {
  const [activeTab, setActiveTab] = useState('semua'); // 'semua' | 'tipis' | 'habis'

  const supplierProducts = useMemo(() =>
    (products || []).filter(p => p.supplier_id === supplier.id),
    [products, supplier.id]
  );

  const tipsProducts = useMemo(() =>
    supplierProducts.filter(p => (p.stok || 0) > 0 && (p.stok || 0) <= STOK_MINIMUM_DEFAULT),
    [supplierProducts]
  );

  const habisProducts = useMemo(() =>
    supplierProducts.filter(p => (p.stok || 0) <= 0),
    [supplierProducts]
  );

  const tabProducts = useMemo(() => {
    if (activeTab === 'tipis') return tipsProducts;
    if (activeTab === 'habis') return habisProducts;
    return supplierProducts;
  }, [activeTab, supplierProducts, tipsProducts, habisProducts]);

  // Generate teks pesan WhatsApp Order Restock
  const handleWhatsAppOrder = () => {
    if (!supplier.kontak_phone) {
      useNotificationStore.getState().showAlert('Nomor WA supplier belum diisi!', 'error');
      return;
    }
    const itemsToOrder = [...habisProducts, ...tipsProducts];
    if (itemsToOrder.length === 0) {
      useNotificationStore.getState().showAlert('Tidak ada barang yang perlu di-restock saat ini.', 'error');
      return;
    }
    const listItems = itemsToOrder.map((p, i) => {
      const sisa = p.stok || 0;
      const status = sisa <= 0 ? 'HABIS' : `Sisa stok: ${sisa}`;
      return `${i + 1}. ${p.nama} (${status})`;
    }).join('\n');

    const message =
      `Halo ${supplier.nama_supplier},\n` +
      `Mohon dikirimkan pesanan restock untuk warung kami:\n\n` +
      `${listItems}\n\n` +
      `Terima kasih.`;

    const waUrl = `https://wa.me/${supplier.kontak_phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const tabs = [
    { id: 'semua', label: 'Semua Barang', count: supplierProducts.length, color: 'blue' },
    { id: 'tipis', label: 'Stok Tipis', count: tipsProducts.length, color: 'yellow' },
    { id: 'habis', label: 'Stok Habis', count: habisProducts.length, color: 'red' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">{supplier.nama_supplier}</h2>
                {supplier.kontak_phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {supplier.kontak_phone}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { onClose(); onEdit(supplier); }}
                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                title="Edit Supplier"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Catatan supplier */}
          {supplier.catatan && (
            <p className="mt-3 text-sm text-gray-500 bg-gray-50 p-3 rounded-xl">
              📝 {supplier.catatan}
            </p>
          )}

          {/* Tombol Chat WA */}
          {supplier.kontak_phone && (
            <button
              onClick={handleWhatsAppOrder}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Buat Order Restock via WhatsApp
            </button>
          )}
        </div>

        {/* Tab Filter */}
        <div className="flex gap-2 px-5 pt-4">
          {tabs.map(tab => {
            const colorMap = {
              blue: 'bg-blue-50 text-blue-700 border-blue-200',
              yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
              red: 'bg-red-50 text-red-700 border-red-200',
            };
            const activeColor = {
              blue: 'bg-blue-500 text-white border-blue-500',
              yellow: 'bg-yellow-500 text-white border-yellow-500',
              red: 'bg-red-500 text-white border-red-500',
            };
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  activeTab === tab.id ? activeColor[tab.color] : `${colorMap[tab.color]} opacity-70`
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] ${
                  activeTab === tab.id ? 'bg-white/30' : 'bg-white'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Daftar Produk */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {tabProducts.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {activeTab === 'semua'
                  ? 'Belum ada produk terdaftar untuk supplier ini.'
                  : 'Tidak ada barang di kategori ini.'}
              </p>
            </div>
          ) : (
            tabProducts.map(p => {
              const stok = p.stok || 0;
              const isHabis = stok <= 0;
              const isTipis = !isHabis && stok <= STOK_MINIMUM_DEFAULT;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    isHabis
                      ? 'bg-red-50 border-red-100'
                      : isTipis
                      ? 'bg-yellow-50 border-yellow-100'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isHabis ? 'bg-red-100' : isTipis ? 'bg-yellow-100' : 'bg-white border border-gray-200'
                    }`}>
                      <Package className={`w-4 h-4 ${isHabis ? 'text-red-500' : isTipis ? 'text-yellow-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.nama}</p>
                      {p.kategori && (
                        <span className="text-[10px] bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded">
                          {p.kategori}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`text-sm font-bold ${isHabis ? 'text-red-600' : isTipis ? 'text-yellow-700' : 'text-gray-700'}`}>
                      {isHabis ? 'HABIS' : `${stok} pcs`}
                    </p>
                    <p className="text-[10px] text-gray-400">{formatRupiah(p.harga_beli)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Komponen: Kartu Supplier ──────────────────────────────────────────────────
const SupplierCard = ({ supplier, products, onClick, onEdit, onDelete }) => {
  const supplierProducts = useMemo(() =>
    (products || []).filter(p => p.supplier_id === supplier.id),
    [products, supplier.id]
  );

  const habisCount = supplierProducts.filter(p => (p.stok || 0) <= 0).length;
  const tipsCount = supplierProducts.filter(p => (p.stok || 0) > 0 && (p.stok || 0) <= STOK_MINIMUM_DEFAULT).length;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all cursor-pointer active:scale-[0.98] group"
    >
      <div className="p-4">
        {/* Header Kartu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
              <Truck className="w-5 h-5 text-primary-500" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800 truncate">{supplier.nama_supplier}</h3>
              {supplier.kontak_phone ? (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" /> {supplier.kontak_phone}
                </p>
              ) : (
                <p className="text-xs text-gray-300 italic mt-0.5">Belum ada no. HP</p>
              )}
            </div>
          </div>

          {/* Tombol Edit/Hapus */}
          <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEdit(supplier)}
              className="p-1.5 text-gray-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(supplier)}
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Hapus"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Info Stok */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              <span>{supplierProducts.length} jenis barang</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {habisCount > 0 && (
              <span className="flex items-center gap-1 bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-red-100">
                <AlertTriangle className="w-3 h-3" />
                {habisCount} habis
              </span>
            )}
            {tipsCount > 0 && (
              <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-yellow-100">
                <Clock className="w-3 h-3" />
                {tipsCount} tipis
              </span>
            )}
            {habisCount === 0 && tipsCount === 0 && supplierProducts.length > 0 && (
              <span className="flex items-center gap-1 bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-green-100">
                <CheckCircle className="w-3 h-3" />
                Aman
              </span>
            )}
          </div>
        </div>

        {/* Catatan singkat */}
        {supplier.catatan && (
          <p className="mt-2 text-xs text-gray-400 truncate border-t border-gray-50 pt-2">
            📝 {supplier.catatan}
          </p>
        )}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between text-xs text-primary-500 font-semibold">
        <span>Lihat daftar produk</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};

// ─── Halaman Utama: Master Supplier ───────────────────────────────────────────
const SupplierMaster = () => {
  const { showAlert } = useNotificationStore();
  const { isKasir } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Ambil semua supplier dari IndexedDB secara reaktif
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('nama_supplier').toArray(), []);

  // Ambil semua produk dari IndexedDB secara reaktif
  const products = useLiveQuery(() => db.products.orderBy('nama').toArray(), []);

  // Filter supplier berdasarkan pencarian
  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    if (!searchQuery.trim()) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(s =>
      s.nama_supplier.toLowerCase().includes(q) ||
      (s.kontak_phone && s.kontak_phone.includes(q)) ||
      (s.catatan && s.catatan.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  // Hitung statistik global
  const stats = useMemo(() => {
    const total = (suppliers || []).length;
    const totalProducts = (products || []).filter(p => p.supplier_id).length;
    const orphanProducts = (products || []).filter(p => !p.supplier_id).length;
    return { total, totalProducts, orphanProducts };
  }, [suppliers, products]);

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setIsFormModalOpen(true);
  };

  const handleDelete = (supplier) => {
    useNotificationStore.getState().showConfirm(
      `Yakin ingin menghapus "${supplier.nama_supplier}"? Produk yang terdaftar di bawahnya tidak akan ikut terhapus.`,
      async () => {
        try {
          await deleteAndSync('suppliers', supplier.id);
          showAlert('Supplier berhasil dihapus', 'success');
        } catch (err) {
          showAlert('Gagal menghapus supplier', 'error');
        }
      }
    );
  };

  const handleCloseForm = () => {
    setIsFormModalOpen(false);
    setEditingSupplier(null);
  };

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="p-4 md:p-6 pb-24 max-w-4xl mx-auto">

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Truck className="w-6 h-6 text-primary-500" />
              Daftar Supplier
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Kelola distributor & petakan produk ke masing-masing pemasok.
            </p>
          </div>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Tambah Supplier
          </button>
        </div>

        {/* ── STATISTIK RINGKAS ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-primary-600">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Supplier</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{stats.totalProducts}</p>
            <p className="text-xs text-gray-500 mt-0.5">Produk Dipetakan</p>
          </div>
          <div className={`bg-white rounded-2xl border p-4 text-center shadow-sm ${stats.orphanProducts > 0 ? 'border-orange-200' : 'border-gray-100'}`}>
            <p className={`text-2xl font-bold ${stats.orphanProducts > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
              {stats.orphanProducts}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Belum Dipetakan</p>
          </div>
        </div>

        {/* Peringatan Produk Belum Dipetakan */}
        {stats.orphanProducts > 0 && (
          <div className="mb-5 flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-orange-800">
                {stats.orphanProducts} produk belum dipetakan ke supplier
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                Buka Master Barang → Edit produk → Pilih Supplier untuk melengkapi data.
              </p>
            </div>
          </div>
        )}

        {/* ── PENCARIAN ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama supplier, nomor HP, atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* ── DAFTAR KARTU SUPPLIER ────────────────────────────────────────────── */}
        {(!suppliers || suppliers.length === 0) ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Truck className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="font-bold text-gray-600 mb-1">Belum Ada Supplier</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
              Tambahkan data distributor dan agen yang rutin memasok barang ke toko Anda.
            </p>
            <button
              onClick={() => setIsFormModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Tambah Supplier Pertama
            </button>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Supplier "{searchQuery}" tidak ditemukan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredSuppliers.map(supplier => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                products={products}
                onClick={() => setSelectedSupplier(supplier)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL FORM TAMBAH / EDIT ─────────────────────────────────────────── */}
      {isFormModalOpen && (
        <SupplierFormModal
          supplier={editingSupplier}
          onClose={handleCloseForm}
        />
      )}

      {/* ── MODAL DETAIL SUPPLIER ────────────────────────────────────────────── */}
      {selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          products={products}
          onClose={() => setSelectedSupplier(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default SupplierMaster;
