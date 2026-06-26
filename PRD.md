# PRD: MaduraDigital Dashboard

**Versi:** 1.0  
**Status:** Draft / Ready for Development

## I. Executive Summary

MaduraDigital adalah sistem manajemen operasional berbasis web yang dirancang khusus untuk Warung Madura yang beroperasi 24/7. Tujuannya adalah mendigitalisasi pencatatan tradisional (buku manual) menjadi sistem digital yang ringkas, tanpa mengganggu kecepatan pelayanan yang menjadi ciri khas warung ini.

## II. User Personas

1. **Pemilik Warung (Owner):** Fokus pada pemantauan laba harian, stok barang habis, dan manajemen supplier dari jarak jauh.
2. **Penjaga Shift (Staff):** Fokus pada kecepatan transaksi (POS), pencatatan bensin eceran/pulsa, dan serah terima shift (kas laci).

## III. User Stories & Acceptance Criteria

### 1. Kasir (POS) & Manajemen Shift

- **User Story:** Sebagai Penjaga Shift, saya ingin melakukan transaksi dengan cepat tanpa barcode scanner agar pelayanan tetap kilat.
- **Kriteria Penerimaan:**
  - Tombol kategori besar (Quick-Tap) untuk Sembako, Rokok, Bensin, dll.
  - Fitur serah terima shift dengan input saldo awal dan akhir.

### 2. Inventaris & FIFO Pintar

- **User Story:** Sebagai Owner, saya ingin tahu barang mana yang akan kadaluwarsa agar bisa dijual lebih dulu (FIFO).
- **Kriteria Penerimaan:**
  - Alert visual berkode warna (Merah/Kuning/Hijau) berdasarkan tanggal kadaluwarsa.
  - Notifikasi otomatis saat stok barang pokok (beras, minyak) mencapai batas minimum.

### 3. Pembukuan & Laba/Rugi

- **User Story:** Sebagai Owner, saya ingin melihat keuntungan bersih harian setelah dikurangi biaya operasional (listrik, angkut).
- **Kriteria Penerimaan:**
  - Dashboard Laba/Rugi real-time.
  - Formulir input pengeluaran kas yang simpel.

## IV. Non-Functional Requirements

- **Mobile-First:** UI harus responsif sempurna di Tablet atau Smartphone.
- **Offline Sync:** Data tersimpan lokal saat koneksi internet terputus (PWA).
- **Keamanan:** Sesi login per shift yang unik.

## V. Data Model (High-Level)

| Tabel          | Deskripsi                                    |
| -------------- | -------------------------------------------- |
| `Users`        | Data Owner dan Staff.                        |
| `Shifts`       | Sesi kerja, saldo kas awal/akhir.            |
| `Products`     | Nama, kategori, harga, stok, expiry_date.    |
| `Transactions` | ID Transaksi, total, item_list, timestamp.   |
| `Expenses`     | List biaya operasional (listrik, air, kuli). |

## VI. Future Roadmap (V2)

- Integrasi QRIS untuk pembayaran non-tunai.
- Fitur "Pre-Order" via WhatsApp pelanggan.
- Laporan pajak UMKM otomatis.

## VII. Technology Stack

Berfokus pada kecepatan, responsivitas, dan kapabilitas offline (PWA), berikut adalah arsitektur dan teknologi yang akan digunakan:

### 1. Frontend & Antarmuka Pengguna
- **Framework Utama:** React.js dipadukan dengan Vite untuk performa kompilasi dan pemuatan aplikasi yang sangat cepat.
- **Styling:** Tailwind CSS v3 (Utility-first CSS framework) untuk pengembangan antarmuka yang sangat cepat, konsisten, dan mempermudah kustomisasi desain premium serta responsif untuk perangkat *mobile*.
- **State Management:** Zustand atau React Context untuk mengelola keranjang transaksi (*cart*) dengan ringan dan efisien secara *real-time*.
- **PWA (Progressive Web App):** Menggunakan `vite-plugin-pwa` untuk Service Worker, memastikan aplikasi dapat diinstal di HP/Tablet dan tetap berfungsi tanpa koneksi internet.

### 2. Database Lokal (Offline Mode)
- **Teknologi Utama:** IndexedDB (Database bawaan browser).
- **Library Bantuan:** Dexie.js. Digunakan untuk menyimpan katalog produk dan antrean transaksi sementara secara lokal saat internet terputus.

### 3. Backend & Database Server
- **Platform:** Supabase (Backend-as-a-Service berbasis PostgreSQL).
- **Keunggulan:** Menyediakan autentikasi yang solid (untuk login *shift*), *real-time database*, dan kapabilitas relasional (SQL) yang sangat ideal untuk keandalan data transaksi POS dan kalkulasi Laba/Rugi.

### 4. Deployment & Hosting
- **Platform:** Vercel atau Netlify.
- **Alasan:** *Deployment* instan, SSL/HTTPS otomatis (wajib untuk PWA), dan performa *delivery* aplikasi yang cepat.
