import React, { useState, useMemo } from "react";
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
  Truck,
  AlertTriangle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { deleteAndSync } from "../../db/db";
import useNotificationStore from "../../store/useNotificationStore";
import useAuthStore from "../../store/useAuthStore";
import useHardwareScanner from "../../hooks/useHardwareScanner";
import { playSuccessBeep, playErrorBeep } from "../../lib/audioUtils";
import { formatRupiah } from "../../lib/utils";

const Inbound = () => {
  const { showConfirm, showAlert } = useNotificationStore();
  const { isKasir, getFullName } = useAuthStore();

  // State Tab & Form
  const [activeTab, setActiveTab] = useState("inbound"); // 'inbound' | 'history'
  const [note, setNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingUpdates, setPendingUpdates] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Modal Pembayaran
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isImpactConfirmed, setIsImpactConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Kas Tunai"); // 'Kas Tunai' | 'Hutang'
  const [selectedSupplierId, setSelectedSupplierId] = useState(""); // ID dari master supplier
  const [dueDate, setDueDate] = useState("");
  const [inboundSummary, setInboundSummary] = useState({
    totalHpp: 0,
    items: [],
  });

  // Daftar semua supplier dari master (untuk dropdown)
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('nama_supplier').toArray(), []);
  // Supplier yang sedang dipilih untuk sesi Inbound ini
  const [activeInboundSupplierId, setActiveInboundSupplierId] = useState(''); // '' = semua barang

  // Data Tab Inbound
  const products = useLiveQuery(
    () => db.products.orderBy("id").reverse().toArray(),
    [],
  );

  const filteredProducts = React.useMemo(() => {
    if (!products) return [];
    const query = searchQuery.toLowerCase();
    // Smart filter: jika ada supplier aktif dipilih, prioritaskan barang supplier tersebut
    let baseList = products;
    if (activeInboundSupplierId) {
      const supplierItems = products.filter(p => p.supplier_id === activeInboundSupplierId);
      const otherItems = products.filter(p => p.supplier_id !== activeInboundSupplierId);
      baseList = [...supplierItems, ...otherItems]; // barang supplier muncul di atas
    }
    if (!searchQuery) return baseList;
    return baseList.filter(
      (p) =>
        p.nama.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.toLowerCase().includes(query)),
    );
  }, [products, searchQuery, activeInboundSupplierId]);

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

  const selectedDraftItems = useMemo(() => {
    return (products || []).filter(
      (p) => pendingUpdates[p.id] && pendingUpdates[p.id] > 0,
    );
  }, [products, pendingUpdates]);

  const estimatedTotalHpp = useMemo(() => {
    return selectedDraftItems.reduce(
      (acc, p) => acc + (p.harga_beli || 0) * (pendingUpdates[p.id] || 0),
      0,
    );
  }, [selectedDraftItems, pendingUpdates]);

  const totalPcsToUpdate = useMemo(() => {
    return selectedDraftItems.reduce(
      (acc, p) => acc + (pendingUpdates[p.id] || 0),
      0,
    );
  }, [selectedDraftItems, pendingUpdates]);

  const handleRemoveFromDraft = (productId) => {
    setPendingUpdates((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
  };

  const handleClearAllDrafts = () => {
    if (totalItemsToUpdate === 0) return;
    showConfirm(
      "Apakah Anda yakin ingin mengosongkan seluruh daftar barang di draft Inbound ini?",
      () => {
        setPendingUpdates({});
        setNote("");
      },
    );
  };

  // ==========================================
  // HARDWARE SCANNER INTEGRATION
  // ==========================================
  useHardwareScanner(async (barcode) => {
    if (activeTab !== "inbound" || isPaymentModalOpen) return;
    
    try {
      const product = await db.products.where('barcode').equals(barcode).first();
      if (product) {
        handleUpdateQty(product.id, 1);
        playSuccessBeep();
        showAlert(`+1 ${product.nama} disiapkan untuk Inbound`, "success");
      } else {
        playErrorBeep();
        showAlert(`Barcode ${barcode} belum terdaftar di Master Barang!`, "error");
      }
    } catch (err) {
      console.error('Error saat men-scan barcode di Inbound:', err);
    }
  }, { enabled: activeTab === "inbound" && !isPaymentModalOpen });
  // ==========================================

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
    setIsImpactConfirmed(false);
    setIsPaymentModalOpen(true);
  };

  const handleConfirmInbound = async () => {
    if (!isImpactConfirmed) {
      showAlert(
        "Anda wajib mencentang kotak konfirmasi dampak transaksi terlebih dahulu!",
        "error",
      );
      return;
    }
    if (paymentMethod === "Hutang" && !selectedSupplierId) {
      showAlert(
        "Pilih supplier dari daftar untuk pencatatan hutang!",
        "error",
      );
      return;
    }
    if (paymentMethod === "Hutang" && !dueDate) {
      showAlert(
        "Tanggal jatuh tempo wajib diisi untuk pencatatan hutang!",
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
        expense_id: null,
        debt_id: null,
        cancelled_at: null,
        cancelled_by: null,
      };

      if (paymentMethod === "Hutang") {
        const selectedSupplier = (suppliers || []).find(s => s.id === selectedSupplierId);
        logDocument.hutang_info = {
          // Sanitasi: simpan null jika ID kosong/tidak dipilih, bukan string "" yang ditolak PostgreSQL UUID
          supplier_id: selectedSupplierId || null,
          supplier_name: selectedSupplier?.nama_supplier || '',
          due_date: new Date(dueDate).getTime(),
        };
        // Sanitasi UUID: string kosong "" akan menyebabkan error di PostgreSQL kolom UUID
        logDocument.supplier_id = selectedSupplierId || null;
      } else if (activeInboundSupplierId) {
        // Catat supplier_id di log meskipun pembayaran tunai
        // Sanitasi UUID: pastikan selalu null jika value falsy/string kosong
        logDocument.supplier_id = activeInboundSupplierId || null;
      }

      if (isAdmin) {
        // JIKA OWNER: Langsung eksekusi stok dan pembukuan secara Atomik
        await db.transaction(
          "rw",
          [db.products, db.inbound_logs, db.expenses, db.debts],
          async () => {
            let expenseId = null;
            let debtId = null;

            // Akuntansi (Catat terlebih dahulu untuk mendapatkan ID)
            if (inboundSummary.totalHpp > 0) {
              if (paymentMethod === "Kas Tunai") {
                expenseId = await db.expenses.add({
                  amount: inboundSummary.totalHpp,
                  description: `Inbound Langsung: ${note}`,
                  timestamp: new Date().getTime(),
                  synced: 0,
                });
              } else if (paymentMethod === "Hutang") {
                const selectedSupplier = (suppliers || []).find(s => s.id === selectedSupplierId);
                debtId = await db.debts.add({
                  supplier_id: selectedSupplierId,
                  supplier_name: selectedSupplier?.nama_supplier || '',
                  description: `Hutang Inbound: ${note}`,
                  amount: inboundSummary.totalHpp,
                  paid_amount: 0,
                  due_date: new Date(dueDate).getTime(),
                  status: "UNPAID",
                  created_at: Date.now(),
                 });
              }
            }

            // Tautkan ID referensi keuangan ke dokumen log
            logDocument.expense_id = expenseId || null;
            logDocument.debt_id = debtId || null;

            // Update Stok
            for (const { product, qty } of inboundSummary.items) {
              await db.products.update(product.id, {
                stok: (product.stok || 0) + qty,
              });
            }
            // Catat Log
            await db.inbound_logs.add(logDocument);
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
      setSelectedSupplierId("");
      setDueDate("");
      // Perbaikan UI Responsif: reset selectedLog ke null agar panel daftar
      // riwayat (kiri) tidak tersembunyi di layar kecil (mobile/tablet)
      // karena kondisi CSS: w-full ${selectedLog ? "hidden lg:flex" : "flex"}
      setSelectedLog(null);
      setActiveTab("history"); // Langsung lempar ke tab riwayat
    } catch (error) {
      console.error("Inbound error:", error);
      showAlert("Gagal mengirim pengajuan Inbound.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fase 3 (Lapisan 2): Kasir/Admin tarik pengajuan PENDING
  const handleWithdrawPending = async (log) => {
    showConfirm(
      "Apakah Anda yakin ingin menarik dan membatalkan pengajuan Inbound ini? Data belum mempengaruhi stok dan keuangan.",
      async () => {
        try {
          await db.inbound_logs.update(log.id, {
            status: "CANCELLED",
            cancelled_at: Date.now(),
            cancelled_by: getFullName(),
          });
          showAlert("Pengajuan Inbound berhasil dibatalkan/ditarik.", "success");
          if (selectedLog?.id === log.id) {
            setSelectedLog((prev) => ({
              ...prev,
              status: "CANCELLED",
              cancelled_at: Date.now(),
              cancelled_by: getFullName(),
            }));
          }
        } catch (error) {
          console.error("Gagal menarik pengajuan:", error);
          showAlert("Terjadi kesalahan saat membatalkan pengajuan.", "error");
        }
      },
    );
  };

  // Fase 4 (Lapisan 3): Owner rollback 1-klik pada Inbound APPROVED
  const handleRollbackApproved = async (log) => {
    let negativeWarning = "";
    for (const item of log.items || []) {
      const p = await db.products.get(item.product_id);
      if (p && (p.stok || 0) - item.qty_masuk < 0) {
        negativeWarning = `\n\nPERINGATAN: Stok '${item.nama}' saat ini (${p.stok} pcs) lebih kecil dari jumlah yang akan ditarik (${item.qty_masuk} pcs). Stok akan menjadi negatif!`;
        break;
      }
    }

    showConfirm(
      `Apakah Anda yakin ingin menganulir dan melakukan Rollback pada Inbound ini? Stok barang akan dikurangi, serta pencatatan kas/hutang terkait akan dihapus.${negativeWarning}`,
      async () => {
        try {
          await db.transaction(
            "rw",
            [
              db.products,
              db.inbound_logs,
              db.expenses,
              db.debts,
              db.pending_deletions,
            ],
            async () => {
              // A. Rollback Stok
              for (const item of log.items || []) {
                const product = await db.products.get(item.product_id);
                if (product) {
                  const newStok = (product.stok || 0) - item.qty_masuk;
                  await db.products.update(product.id, { stok: newStok });
                }
              }

              // B. Rollback Keuangan
              if (log.expense_id) {
                await deleteAndSync("expenses", log.expense_id);
              }
              if (log.debt_id) {
                await deleteAndSync("debts", log.debt_id);
              }

              // C. Update Status Log
              await db.inbound_logs.update(log.id, {
                status: "CANCELLED",
                cancelled_at: Date.now(),
                cancelled_by: getFullName(),
              });
            },
          );

          showAlert(
            "Inbound berhasil dianulir! Stok, kas tunai, dan hutang supplier telah dikembalikan ke posisi semula.",
            "success",
          );
          if (selectedLog?.id === log.id) {
            setSelectedLog((prev) => ({
              ...prev,
              status: "CANCELLED",
              cancelled_at: Date.now(),
              cancelled_by: getFullName(),
            }));
          }
        } catch (error) {
          console.error("Gagal rollback:", error);
          showAlert(
            "Terjadi kesalahan sistem saat melakukan rollback.",
            "error",
          );
        }
      },
    );
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
              {/* Filter Supplier Aktif */}
              {suppliers && suppliers.length > 0 && (
                <div className="mb-3 flex items-center gap-2 bg-primary-50/70 border border-primary-100 rounded-xl px-3 py-2">
                  <Truck className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <select
                    value={activeInboundSupplierId}
                    onChange={(e) => setActiveInboundSupplierId(e.target.value)}
                    className="flex-1 text-sm bg-transparent outline-none text-primary-800 font-semibold cursor-pointer"
                  >
                    <option value="">🏪 Semua Supplier (Tampilkan Semua Barang)</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>🚚 Fokus: {s.nama_supplier}</option>
                    ))}
                  </select>
                </div>
              )}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Save className="w-5 h-5 text-primary-500" />
                  Ringkasan Inbound
                </h3>
                {totalItemsToUpdate > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllDrafts}
                    className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Kosongkan
                  </button>
                )}
              </div>

              {/* Kartu Metrik Ganda */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="bg-primary-50/80 border border-primary-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] font-bold text-primary-600 uppercase tracking-wider mb-0.5">
                    Total SKU
                  </span>
                  <span className="text-xl font-extrabold text-primary-700">
                    {totalItemsToUpdate}{" "}
                    <span className="text-xs font-normal text-primary-600">
                      ({totalPcsToUpdate} pcs)
                    </span>
                  </span>
                </div>
                <div className="bg-amber-50/80 border border-amber-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">
                    Est. Modal
                  </span>
                  <span className="text-sm font-extrabold text-amber-700 line-clamp-1">
                    {formatRupiah(estimatedTotalHpp)}
                  </span>
                </div>
              </div>

              {/* Interactive Draft List */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Daftar Barang Dipilih ({totalItemsToUpdate})
                </label>
                <div className="border border-gray-200 rounded-xl bg-gray-50/50 p-2 max-h-56 overflow-y-auto divide-y divide-gray-100 space-y-1.5">
                  {selectedDraftItems.length === 0 ? (
                    <div className="py-6 px-4 text-center flex flex-col items-center justify-center text-gray-400">
                      <Package className="w-8 h-8 text-gray-300 mb-1.5" />
                      <p className="text-xs font-medium text-gray-500">
                        Belum ada barang dipilih
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Scan barcode atau klik tombol + pada tabel di samping
                      </p>
                    </div>
                  ) : (
                    selectedDraftItems.map((p) => {
                      const qty = pendingUpdates[p.id] || 0;
                      return (
                        <div
                          key={p.id}
                          className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-800 line-clamp-1">
                              {p.nama}
                            </p>
                            <span className="text-[10px] font-mono text-gray-500 block">
                              {p.barcode || "NO-SKU"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="font-bold text-primary-700 bg-primary-100/80 px-2 py-0.5 rounded-md text-[11px]">
                              +{qty} pcs
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromDraft(p.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus dari draft"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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
                      Supplier / Penagih *
                    </label>
                    {(suppliers && suppliers.length > 0) ? (
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 bg-white"
                      >
                        <option value="">-- Pilih Supplier --</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.nama_supplier}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-lg border border-orange-100">
                        Belum ada master supplier. Minta Admin tambahkan di menu <strong>Inventory → Daftar Supplier</strong>.
                      </p>
                    )}
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


              {/* Card Ringkasan Dampak */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-2 mt-2">
                <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Ringkasan Dampak Transaksi
                </p>
                <div className="text-xs text-amber-800 space-y-1.5 pl-1">
                  <p className="flex items-start gap-1.5">
                    <span>📦</span>
                    <span>
                      <strong>Dampak Stok:</strong> {inboundSummary.items.length} SKU (Total {inboundSummary.items.reduce((acc, i) => acc + i.qty, 0)} pcs) akan ditambahkan ke Master Barang.
                    </span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <span>💰</span>
                    <span>
                      <strong>Dampak Keuangan:</strong>{" "}
                      {inboundSummary.totalHpp > 0
                        ? paymentMethod === "Kas Tunai"
                          ? `Kas Tunai akan berkurang sebesar ${formatRupiah(inboundSummary.totalHpp)}.`
                          : `Hutang supplier akan bertambah sebesar ${formatRupiah(inboundSummary.totalHpp)}.`
                        : "Tidak ada dampak finansial (Rp 0)."}
                    </span>
                  </p>
                </div>
              </div>

              {/* Checkbox Konfirmasi */}
              <label className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100/60 transition-colors select-none mt-3">
                <input
                  type="checkbox"
                  checked={isImpactConfirmed}
                  onChange={(e) => setIsImpactConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <span className="text-xs text-gray-700 font-medium leading-relaxed">
                  Saya telah memeriksa dan memastikan bahwa jumlah barang, supplier, dan metode bayar di atas sudah benar.
                </span>
              </label>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={handleConfirmInbound}
                disabled={isSubmitting || !isImpactConfirmed}
                className={`w-full py-3.5 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                  isSubmitting || !isImpactConfirmed
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                    : "bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/30 active:scale-95"
                }`}
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
                              : log.status === "CANCELLED"
                                ? "bg-gray-200 text-gray-600 line-through"
                                : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {log.status === "APPROVED"
                          ? "DISETUJUI"
                          : log.status === "REJECTED"
                            ? "DITOLAK"
                            : log.status === "CANCELLED"
                              ? "DIANULIR"
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
                    {selectedLog.status === "CANCELLED" && (
                      <div className="mb-3 p-3 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-700 flex items-start gap-2.5">
                        <span className="text-base">ℹ️</span>
                        <div>
                          <strong className="font-bold block text-gray-800">Dokumen Telah Dianulir / Dibatalkan</strong>
                          Dibatalkan oleh <strong>{selectedLog.cancelled_by || 'System'}</strong> pada {selectedLog.cancelled_at ? formatDate(selectedLog.cancelled_at) : 'waktu tidak dicatat'}. Seluruh dampak stok barang dan pembukuan keuangan (kas/hutang) telah di-rollback.
                        </div>
                      </div>
                    )}
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
                              ) : selectedLog.status === "CANCELLED" ? (
                                <span className="text-gray-400 line-through">
                                  {item.stok_sesudahnya}
                                </span>
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

                {/* Footer Aksi Detail (Lapisan 2: Tarik Kasir | Lapisan 3: Rollback Owner) */}
                {selectedLog.status === "PENDING" && (
                  <div className="p-4 bg-yellow-50/80 border-t border-yellow-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-yellow-800">
                      <p className="font-bold flex items-center gap-1.5">
                        <span>⏳</span> Menunggu Persetujuan Owner
                      </p>
                      <p className="text-yellow-700 mt-0.5">
                        Jika terjadi kesalahan input, Anda dapat membatalkan pengajuan ini sekarang sebelum diperiksa oleh Owner.
                      </p>
                    </div>
                    <button
                      onClick={() => handleWithdrawPending(selectedLog)}
                      className="px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Batalkan / Tarik Pengajuan
                    </button>
                  </div>
                )}

                {selectedLog.status === "APPROVED" && !isKasir() && (
                  <div className="p-4 bg-red-50/80 border-t border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-red-800">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        Fitur Khusus Admin: 1-Klik Rollback Otomatis
                      </p>
                      <p className="text-red-700 mt-0.5">
                        Anulir transaksi ini untuk mengembalikan stok barang, serta menghapus catatan pengeluaran kas atau hutang.
                      </p>
                    </div>
                    <button
                      onClick={() => handleRollbackApproved(selectedLog)}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Batalkan & Rollback
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbound;
