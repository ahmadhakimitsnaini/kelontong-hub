import { formatTanggal, formatWaktu, formatRupiah } from './utils';
import useNotificationStore from '../store/useNotificationStore';

/**
 * Mengonversi array of objects menjadi format CSV dan memicu unduhan.
 * @param {Array} data - Array data transaksi atau laporan.
 * @param {String} filename - Nama file yang akan diunduh tanpa ekstensi.
 */
export const exportToCSV = (data, filename) => {
  if (!data || !data.length) {
    useNotificationStore.getState().showAlert("Tidak ada data untuk diexport", "error");
    return;
  }

  // 1. Ambil keys dari object pertama sebagai header
  const headers = Object.keys(data[0]);
  
  // 2. Buat array string CSV
  const csvRows = [];
  
  // Header row
  csvRows.push(headers.join(','));
  
  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] !== null && row[header] !== undefined ? row[header] : '';
      // Escape string yang mengandung koma atau newline dengan tanda kutip ganda
      const stringVal = String(val);
      if (stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('"')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    });
    csvRows.push(values.join(','));
  }

  // 3. Gabungkan semua baris
  const csvContent = csvRows.join('\n');
  
  // 4. Buat Blob dan Link untuk mengunduh
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().getTime()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  
  link.click();
  
  document.body.removeChild(link);
};

/**
 * Fungsi helper untuk memformat data transaksi menjadi bentuk yang rapi untuk diexport.
 */
export const formatTransactionsForExport = (transactions) => {
  return transactions.map(trx => {
    const itemsList = trx.items 
      ? trx.items.map(i => `${i.quantity}x ${i.nama}`).join(" | ")
      : "-";
      
    return {
      "ID Transaksi": trx.id || "-",
      "Waktu Transaksi": formatTanggal(trx.timestamp) + " " + formatWaktu(trx.timestamp),
      "Metode Pembayaran": trx.payment_method || "Tunai",
      "Item Terjual": itemsList,
      "Total Belanja (Rp)": trx.total || 0,
      "Uang Diterima (Rp)": trx.amount_paid || 0,
      "Kembalian (Rp)": trx.kembalian || 0,
    };
  });
};

/**
 * Fungsi helper untuk memformat data pengeluaran.
 */
export const formatExpensesForExport = (expenses) => {
  return expenses.map(exp => ({
    "ID Pengeluaran": exp.id || "-",
    "Waktu": formatTanggal(exp.timestamp) + " " + formatWaktu(exp.timestamp),
    "Keterangan": exp.description,
    "Nominal (Rp)": exp.amount
  }));
};
