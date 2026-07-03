import React, { useState } from "react";
import {
  PackagePlus,
  Save,
  Search,
  Plus,
  Minus,
  Package,
  History,
  Clock,
  FileText,
  Wallet,
  CreditCard,
  X,
  CheckCircle,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../../db/db";
import useNotificationStore from "../../store/useNotificationStore";
import useAuthStore from "../../store/useAuthStore";
import { formatRupiah } from "../../lib/utils";

const Inbound = () => {
  const { showAlert } = useNotificationStore();
  const { getFullName, isKasir } = useAuthStore();

  const [activeTab, setActiveTab] = useState("inbound"); // 'inbound' | 'history'
  const [note, setNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingUpdates, setPendingUpdates] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Pembayaran/Pendanaan Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Kas Tunai"); // 'Kas Tunai' | 'Hutang'
  const [supplierName, setSupplierName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [inboundSummary, setInboundSummary] = useState({
    totalHpp: 0,
    items: [],
  });

  // Data Tab Inbound
  const products = useLiveQuery(
    () => db.products.orderBy("id").reverse().toArray(),
    [],
  );

  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.nama.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.toLowerCase().includes(query)),
    );
  }, [products, searchQuery]);

  // Data Tab Riwayat
  const inboundLogs = useLiveQuery(
    () => db.inbound_logs.orderBy("timestamp").reverse().toArray(),
    [],
  );
  const [selectedLog, setSelectedLog] = useState(null); // State detail riwayat

  const handleUpdateQty = (productId, delta, newValue = null) => {
    setPendingUpdates((prev) => {
      const currentQty = prev[productId] || 0;
      let newQty =
        newValue !== null ? parseInt(newValue) || 0 : currentQty + delta;

      if (newQty <= 0) {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const totalItemsToUpdate = Object.keys(pendingUpdates).length;

  const handlePreSave = async (e) => {
    e.preventDefault();
    if (totalItemsToUpdate === 0 || note.trim() === "") {
      showAlert(
        "Isi kuantitas barang dan catatan nota terlebih dahulu!",
        "error",
      );
      return;
    }

    // Hitung total nilai modal (HPP) untuk integrasi akuntansi
    let totalHpp = 0;
    const itemsToProcess = [];
    const productIds = Object.keys(pendingUpdates);

    for (const id of productIds) {
      const product = await db.products.get(id);
      if (product) {
        const qty = pendingUpdates[id];
        totalHpp += (product.harga_beli || 0) * qty;
        itemsToProcess.push({ product, qty });
      }
    }

    setInboundSummary({ totalHpp, items: itemsToProcess });
    setIsPaymentModalOpen(true);
  };

  const handleConfirmInbound = async () => {
    if (paymentMethod === "Hutang" && (!supplierName.trim() || !dueDate)) {
      showAlert(
        "Nama supplier dan tanggal jatuh tempo wajib diisi untuk pencatatan hutang!",
        "error",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const logItems = [];
      let totalBarangFisik = 0;

      for (const { product, qty } of inboundSummary.items) {
        let currentStok = product.stok || 0;
        let newStok = currentStok + qty;

        // Rekam jejak per item (Stok HANYA DRAFT, belum masuk ke db.products)
        logItems.push({
          product_id: product.id,
          nama: product.nama,
          barcode: product.barcode,
          qty_masuk: qty,
          stok_sebelumnya: currentStok,
          stok_sesudahnya: newStok,
          subtotal_hpp: qty * (product.harga_beli || 0),
        });
        totalBarangFisik += qty;
      }

      const timestamp = new Date().toISOString();
      const isAdmin = !isKasir();

      const logDocument = {
        timestamp,
        kasir_nama: getFullName(),
        catatan: note || "-",
        total_sku: logItems.length,
        total_barang: totalBarangFisik,
        total_nilai: inboundSummary.totalHpp,
        sumber_dana: paymentMethod,
        items: logItems,
        status: isAdmin ? "APPROVED" : "PENDING",
        synced: 0,
      };

      if (paymentMethod === "Hutang") {
        logDocument.hutang_info = {
          supplier_name: supplierName,
          due_date: new Date(dueDate).getTime(),
        };
      }

      if (isAdmin) {
        // JIKA OWNER: Langsung eksekusi stok dan pembukuan secara Atomik
        await db.transaction(
          "rw",
          [db.products, db.inbound_logs, db.expenses, db.debts],
          async () => {
            // Update Stok
            for (const { product, qty } of inboundSummary.items) {
              await db.products.update(product.id, {
                stok: (product.stok || 0) + qty,
              });
            }
            // Catat Log
            await db.inbound_logs.add(logDocument);

            // Akuntansi
            if (inboundSummary.totalHpp > 0) {
              if (paymentMethod === "Kas Tunai") {
                await db.expenses.add({
                  amount: inboundSummary.totalHpp,
                  description: `Inbound Langsung: ${note}`,
                  timestamp: new Date().getTime(),
                  synced: 0,
                });
              } else if (paymentMethod === "Hutang") {
                await db.debts.add({
                  supplier_name: supplierName,
                  description: `Hutang Inbound: ${note}`,
                  amount: inboundSummary.totalHpp,
                  paid_amount: 0,
                  due_date: new Date(dueDate).getTime(),
                  status: "UNPAID",
                  created_at: Date.now(),
                });
              }
            }
          },
        );
        showAlert(
          `Inbound berhasil! Stok langsung ditambahkan karena Anda adalah Owner.`,
          "success",
        );
      } else {
        // JIKA KASIR: Hanya masuk Draft
        await db.inbound_logs.add(logDocument);
        showAlert(
          `Pengajuan Inbound berhasil dikirim ke Owner untuk di-approve!`,
          "success",
        );

        const ownerPhone = "6285737421084";
        const approvalUrl = `${window.location.origin}/inventory/approval`;
        const waMessage = `Halo Bos, saya ${getFullName()} (Kasir). Ada pengajuan Inbound barang masuk senilai *${formatRupiah(inboundSummary.totalHpp)}* (${logItems.length} SKU).\n\nCatatan: ${note}\n\nMohon segera di-*Approve* melalui link berikut agar stok dapat dijual:\n${approvalUrl}`;
        const waLink = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(waMessage)}`;
        window.open(waLink, "_blank");
      }

      // Reset State
      setPendingUpdates({});
      setNote("");
      setSearchQuery("");
      setIsPaymentModalOpen(false);
      setPaymentMethod("Kas Tunai");
      setSupplierName("");
      setDueDate("");
      setActiveTab("history"); // Langsung lempar ke tab riwayat
    } catch (error) {
      console.error("Inbound error:", error);
      showAlert("Gagal mengirim pengajuan Inbound.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-full flex flex-col relative">
      {/* Header & Navigasi Tab */}
      <div className="mb-6 flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-primary-500" />
            Inbound & Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistem penerimaan barang terintegrasi dengan pembukuan (HPP/Hutang).
          </p>
        </div>

        {/* TABS */}
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner w-full md:w-auto overflow-hidden">
          <button
            onClick={() => setActiveTab("inbound")}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === "inbound" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <PackagePlus className="w-4 h-4" />
            Inbound Baru
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              setSelectedLog(null);
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === "history" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <History className="w-4 h-4" />
            Riwayat Masuk
          </button>
        </div>
      </div>

      {/* ── TAB 1: INBOUND BARU ───────────────────────────────────────────── */}
      {activeTab === "inbound" && (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 lg:min-h-0 animate-in fade-in">
          {/* Kolom Kiri: Tabel Data Utama */}
          <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[60vh] lg:min-h-0 overflow-hidden relative">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0 z-20 relative shadow-[0_4px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Mesin Pencari: Ketik nama produk atau scan barcode SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all font-medium shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="border-b border-gray-200 text-sm text-gray-500 bg-gray-50">
                    <th className="p-4 font-semibold w-16 text-center">No</th>
                    <th className="p-4 font-semibold">Informasi Produk</th>
                    <th className="p-4 font-semibold text-center w-32">
                      Stok Saat Ini
                    </th>
                    <th className="p-4 font-semibold text-center w-48">
                      Tambahan Masuk (+)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!filteredProducts || filteredProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="p-12 text-center text-gray-500"
                      >
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="font-medium text-gray-600">
                          Produk tidak ditemukan.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, index) => {
                      const additionalQty = pendingUpdates[p.id] || 0;
                      const isUpdated = additionalQty > 0;

                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-gray-50 transition-colors ${isUpdated ? "bg-primary-50/40" : "hover:bg-gray-50"}`}
                        >
                          <td className="p-4 text-center font-medium text-gray-400">
                            {index + 1}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
                                {p.images && p.images[0] ? (
                                  <img
                                    src={p.images[0]}
                                    alt={p.nama}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-6 h-6 text-gray-300" />
                                )}
                              </div>
                              <div>
                                <p
                                  className={`font-bold line-clamp-1 ${isUpdated ? "text-primary-700" : "text-gray-800"}`}
                                >
                                  {p.nama}
                                </p>
                                <span className="text-[11px] font-mono bg-gray-100 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded shadow-sm mt-1 inline-block">
                                  {p.barcode || "NO-SKU"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-center font-bold text-gray-600 text-lg bg-gray-100 rounded-lg py-2 border border-gray-200">
                              {p.stok || 0}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 transition-all">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(p.id, -1)}
                                className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-200 text-gray-600 transition-colors border-r border-gray-200"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={additionalQty === 0 ? "" : additionalQty}
                                onChange={(e) =>
                                  handleUpdateQty(p.id, 0, e.target.value)
                                }
                                placeholder="0"
                                className="w-16 h-10 text-center font-bold text-primary-600 outline-none appearance-none bg-transparent"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(p.id, 1)}
                                className="w-10 h-10 flex items-center justify-center bg-primary-50 hover:bg-primary-100 text-primary-600 transition-colors border-l border-primary-100"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kolom Kanan: Panel Aksi & Simpan */}
          <div className="w-full lg:w-80 flex flex-col gap-4 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Save className="w-5 h-5 text-primary-500" />
                Ringkasan Inbound
              </h3>
              <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 flex flex-col items-center justify-center mb-5">
                <span className="text-sm font-semibold text-primary-600 mb-1">
                  Total SKU Masuk
                </span>
                <span className="text-4xl font-bold text-primary-700">
                  {totalItemsToUpdate}
                </span>
              </div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Referensi Nota / Catatan <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Nota Supplier Indofood #123..."
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:bg-white focus:ring-2 outline-none resize-none transition-colors mb-6 shadow-sm ${totalItemsToUpdate > 0 && note.trim() === "" ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : "border-gray-200 focus:border-primary-500 focus:ring-primary-500/20"}`}
              />
              <button
                type="button"
                onClick={handlePreSave}
                disabled={totalItemsToUpdate === 0 || note.trim() === ""}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition-all shadow-lg ${
                  totalItemsToUpdate === 0 || note.trim() === ""
                    ? "bg-gray-300 cursor-not-allowed shadow-none"
                    : "bg-primary-500 hover:bg-primary-600 shadow-primary-500/30 active:scale-[0.98]"
                }`}
              >
                <Save className="w-5 h-5" />
                {!isKasir()
                  ? "Simpan & Tambah Stok"
                  : "Ajukan Inbound ke Owner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PEMBAYARAN AKUNTANSI ────────────────────────────────────── */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsPaymentModalOpen(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">
                Detail Pendanaan Inbound
              </h2>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {/* Info Total Modal */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center">
                <span className="text-sm font-medium text-blue-600 mb-1">
                  Total Modal (Berdasarkan HPP)
                </span>
                <span className="text-3xl font-bold text-blue-700">
                  {formatRupiah(inboundSummary.totalHpp)}
                </span>
                {inboundSummary.totalHpp === 0 && (
                  <span className="text-xs text-orange-600 mt-2 font-medium bg-orange-100 px-2 py-1 rounded text-center">
                    Peringatan: Harga pokok barang belum diisi di Master Barang.
                  </span>
                )}
              </div>

              {/* Pilihan Sumber Dana */}
              {inboundSummary.totalHpp > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Sumber Dana / Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod("Kas Tunai")}
                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        paymentMethod === "Kas Tunai"
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <Wallet className="w-6 h-6" />
                      <span className="text-xs font-semibold text-center">
                        Lunas (Potong Kas)
                      </span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("Hutang")}
                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        paymentMethod === "Hutang"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <CreditCard className="w-6 h-6" />
                      <span className="text-xs font-semibold text-center">
                        Hutang ke Supplier
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Form Input Hutang (Jika pilih Hutang) */}
              {paymentMethod === "Hutang" && inboundSummary.totalHpp > 0 && (
                <div className="animate-in slide-in-from-top-2 duration-300 space-y-3 bg-red-50/50 p-4 rounded-xl border border-red-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nama Supplier / Penagih *
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: PT. Indofood Sukses"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Tanggal Jatuh Tempo *
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 bg-white"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === "Kas Tunai" && inboundSummary.totalHpp > 0 && (
                <p className="text-xs text-gray-500 text-center bg-gray-50 p-2 rounded-lg">
                  Kas tunai di laporan Neraca akan berkurang sebesar{" "}
                  {formatRupiah(inboundSummary.totalHpp)}.
                </p>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={handleConfirmInbound}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {isSubmitting
                  ? "Memproses..."
                  : !isKasir()
                    ? "Konfirmasi & Tambah Stok"
                    : "Konfirmasi & Kirim WA ke Owner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: RIWAYAT LOG INBOUND ────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col lg:flex-row animate-in fade-in min-h-0 mt-6">
          {/* List Riwayat (Kiri) */}
          <div
            className={`w-full ${selectedLog ? "hidden lg:flex" : "flex"} lg:w-1/3 flex-col border-r border-gray-100 h-full`}
          >
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-500" />
                Daftar Aktivitas
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!inboundLogs || inboundLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Belum ada rekam jejak inbound.
                </div>
              ) : (
                inboundLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${selectedLog?.id === log.id ? "bg-primary-50/50 border-l-4 border-l-primary-500" : "hover:bg-gray-50 border-l-4 border-l-transparent"}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-gray-400">
                        {formatDate(log.timestamp)}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          log.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : log.status === "REJECTED"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {log.status === "APPROVED"
                          ? "DISETUJUI"
                          : log.status === "REJECTED"
                            ? "DITOLAK"
                            : "MENUNGGU"}
                      </span>
                    </div>
                    <p className="font-bold text-gray-800 line-clamp-1 mb-1">
                      {log.catatan}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                      <span className="font-medium text-primary-600 bg-primary-50 px-2 rounded">
                        {log.total_sku} SKU
                      </span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded ${log.sumber_dana === "Hutang" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
                      >
                        {log.sumber_dana || "Kas Tunai"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detail Riwayat (Kanan) */}
          <div
            className={`flex-1 flex-col h-full bg-gray-50/30 ${selectedLog ? "flex" : "hidden lg:flex"}`}
          >
            {!selectedLog ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <FileText className="w-16 h-16 text-gray-200 mb-4" />
                <p className="text-lg font-medium text-gray-500">
                  Pilih riwayat di samping untuk melihat rincian barang masuk
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full animate-in fade-in duration-200">
                {/* Header Detail */}
                <div className="p-6 border-b border-gray-100 bg-white flex flex-col md:flex-row md:items-start justify-between shadow-sm z-10 gap-4">
                  <div>
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="lg:hidden mb-4 text-sm text-primary-600 font-bold flex items-center gap-1 bg-primary-50 px-3 py-1.5 rounded-lg"
                    >
                      &larr; Kembali
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 mb-3">
                      {selectedLog.catatan}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg shadow-sm">
                        <Clock className="w-4 h-4 text-gray-400" />{" "}
                        {formatDate(selectedLog.timestamp)}
                      </span>
                      <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg shadow-sm">
                        Oleh:{" "}
                        <strong className="text-gray-700">
                          {selectedLog.kasir_nama}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div
                    className={`p-4 rounded-xl border flex flex-col items-end ${selectedLog.sumber_dana === "Hutang" ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}
                  >
                    <span className="text-xs font-semibold mb-1 uppercase tracking-wide opacity-70">
                      Nilai Inbound
                    </span>
                    <span
                      className={`text-xl font-bold ${selectedLog.sumber_dana === "Hutang" ? "text-red-700" : "text-green-700"}`}
                    >
                      {formatRupiah(selectedLog.total_nilai || 0)}
                    </span>
                    <span className="text-xs font-medium mt-1">
                      Pembayaran: {selectedLog.sumber_dana || "Kas Tunai"}
                    </span>
                  </div>
                </div>

                {/* Daftar Item Detail */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                  <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                    Rincian Barang yang Dimasukkan
                    <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs">
                      {selectedLog.items.length} Item
                    </span>
                  </h3>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50/80 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="p-4 font-semibold">
                            SKU / Nama Produk
                          </th>
                          <th className="p-4 font-semibold text-center w-24">
                            Stok Awal
                          </th>
                          <th className="p-4 font-semibold text-center w-24 text-primary-600">
                            Masuk (+)
                          </th>
                          <th className="p-4 font-semibold text-center w-24">
                            Stok Akhir
                          </th>
                          <th className="p-4 font-semibold text-right w-32">
                            Total HPP
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLog.items.map((item, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="p-4">
                              <p className="font-bold text-gray-800 text-sm mb-0.5">
                                {item.nama}
                              </p>
                              <span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                {item.barcode || "NO-SKU"}
                              </span>
                            </td>
                            <td className="p-4 text-center text-sm font-medium text-gray-500">
                              {item.stok_sebelumnya}
                            </td>
                            <td className="p-4 text-center text-sm font-bold text-primary-600 bg-primary-50/30">
                              +{item.qty_masuk}
                            </td>
                            <td className="p-4 text-center text-sm font-bold text-gray-800">
                              {selectedLog.status === "APPROVED" ? (
                                item.stok_sesudahnya
                              ) : (
                                <span className="text-gray-400 italic">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right text-sm font-bold text-gray-600">
                              {formatRupiah(item.subtotal_hpp || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbound;
