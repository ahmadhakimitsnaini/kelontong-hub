/**
 * MaduraDigital - Utility / Helper Functions
 *
 * Kumpulan fungsi pembantu yang digunakan di seluruh aplikasi.
 */

// ── Format Angka & Mata Uang ────────────────────────────────────────────────

/**
 * Memformat angka menjadi format Rupiah Indonesia.
 * @param {number} angka - Angka yang akan diformat
 * @returns {string} - Contoh: 15000 → "Rp 15.000"
 */
export const formatRupiah = (angka) => {
  if (angka === null || angka === undefined || isNaN(angka)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka)
}

/**
 * Memformat angka menjadi format singkat (untuk kartu metrik dashboard).
 * @param {number} angka
 * @returns {string} - Contoh: 1500000 → "1,5 Jt"
 */
export const formatAngkaSingkat = (angka) => {
  if (angka >= 1_000_000_000) return `${(angka / 1_000_000_000).toFixed(1)} M`
  if (angka >= 1_000_000) return `${(angka / 1_000_000).toFixed(1)} Jt`
  if (angka >= 1_000) return `${(angka / 1_000).toFixed(0)} Rb`
  return String(angka)
}

// ── Format Tanggal & Waktu ──────────────────────────────────────────────────

/**
 * Memformat tanggal menjadi format lokal Indonesia.
 * @param {string|Date} tanggal
 * @returns {string} - Contoh: "Sabtu, 27 Juni 2026"
 */
export const formatTanggal = (tanggal) => {
  return new Date(tanggal).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Memformat tanggal dan waktu secara singkat.
 * @param {string|Date} tanggal
 * @returns {string} - Contoh: "27/06/2026, 03:15"
 */
export const formatTanggalSingkat = (tanggal) => {
  return new Date(tanggal).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Kalkulasi Kadaluwarsa (untuk FIFO Pintar) ───────────────────────────────

/**
 * Menghitung selisih hari antara hari ini dan tanggal kadaluwarsa.
 * @param {string|Date} expiryDate - Tanggal kadaluwarsa produk
 * @returns {number} - Jumlah hari tersisa (negatif jika sudah kadaluwarsa)
 */
export const hitungSisaHari = (expiryDate) => {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  const selisih = expiry - today
  return Math.ceil(selisih / (1000 * 60 * 60 * 24))
}

/**
 * Menentukan status kadaluwarsa untuk indikator warna FIFO Pintar.
 * @param {string|Date} expiryDate - Tanggal kadaluwarsa produk
 * @returns {'merah'|'kuning'|'hijau'|null} - Status warna
 */
export const getStatusKadaluwarsa = (expiryDate) => {
  const sisaHari = hitungSisaHari(expiryDate)
  if (sisaHari === null) return null
  if (sisaHari <= 7) return 'merah'
  if (sisaHari <= 30) return 'kuning'
  return 'hijau'
}

/**
 * Mendapatkan class Tailwind berdasarkan status kadaluwarsa.
 * @param {string|Date} expiryDate
 * @returns {object} - Object berisi class untuk badge dan teks
 */
export const getKadaluwarsaClass = (expiryDate) => {
  const status = getStatusKadaluwarsa(expiryDate)
  const map = {
    merah: {
      badge: 'bg-red-100 text-red-700 border-red-200',
      dot: 'bg-red-500',
      label: 'Segera Habis',
    },
    kuning: {
      badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      dot: 'bg-yellow-400',
      label: 'Perhatian',
    },
    hijau: {
      badge: 'bg-green-100 text-green-700 border-green-200',
      dot: 'bg-green-500',
      label: 'Aman',
    },
  }
  return map[status] || map['hijau']
}

// ── Lain-lain ───────────────────────────────────────────────────────────────

/**
 * Menghasilkan ID transaksi unik dengan format sederhana.
 * @returns {string} - Contoh: "TRX-20260627-00042"
 */
export const generateIdTransaksi = () => {
  const now = new Date()
  const tanggal = now.toISOString().slice(0, 10).replace(/-/g, '')
  const acak = Math.floor(Math.random() * 99999).toString().padStart(5, '0')
  return `TRX-${tanggal}-${acak}`
}
