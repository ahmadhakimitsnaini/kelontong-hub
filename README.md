# 🏪 MaduraDigital (Kelontong-Hub)

**MaduraDigital** adalah aplikasi Point of Sale (POS) dan manajemen inventaris modern yang dirancang khusus untuk toko kelontong atau "Warung Madura". 

Aplikasi ini dibangun dengan konsep **Mobile-First** dan **Offline-First**, memastikan kasir dapat melayani pembeli secepat kilat (*Quick-Tap*) hanya dari layar HP/Tablet, bahkan ketika koneksi internet sedang terputus sama sekali.

---

## 🚀 Fitur Unggulan

1. **⚡ Kasir Cepat (Quick-Tap POS)**
   - Desain tombol produk yang besar (*thumb-friendly*) untuk layar sentuh, menghilangkan ketergantungan pada *barcode scanner*.
   - Filter kategori pintar yang mendeteksi jenis barang secara otomatis.
   - Mengurangi stok barang secara instan dari gudang setelah pembayaran (checkout).

2. **📦 Inventaris & FIFO Pintar (First In, First Out)**
   - **Indikator Kadaluwarsa Visual:** Barang yang akan segera basi/kadaluwarsa diberi label merah (< 7 hari) atau kuning (< 1 bulan) agar segera dipajang di depan.
   - **Peringatan Stok Menipis:** Angka stok akan berubah warna menjadi peringatan kuning jika tersisa 5 buah atau kurang, memudahkan *Owner* untuk kulakan.

3. **📈 Dashboard Laba/Rugi Real-time**
   - Menghitung **Laba Kotor** otomatis (Omzet - Modal/Harga Beli).
   - Fitur pencatatan **Pengeluaran Kas** (Bayar listrik, es batu, kuli).
   - Mengkalkulasi **Laba Bersih** harian secara *real-time* di kartu metrik berdesain premium.

4. **📶 Mode Offline (Lokal Database)**
   - Transaksi tidak akan pernah tertunda karena sinyal jelek. Seluruh data (Produk, Transaksi, Pengeluaran) disimpan secara lokal di mesin kasir (Browser IndexedDB) dan bekerja 100% tanpa internet.

---

## 🛠️ Tech Stack (Teknologi yang Digunakan)

- **Frontend Framework:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v3](https://tailwindcss.com/) (Custom Theme & *Glassmorphism*)
- **Routing:** React Router v6
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) (Ringan dan cepat untuk keranjang belanja)
- **Local Database:** [Dexie.js](https://dexie.org/) (Wrapper IndexedDB untuk operasi offline) + `dexie-react-hooks` untuk reaktivitas *real-time*.
- **Icons:** [Lucide React](https://lucide.dev/)
- **PWA (Progressive Web App):** *vite-plugin-pwa* (Dapat diinstal layaknya aplikasi native di Android/iOS).

---

## 📂 Struktur Proyek

```text
├── src/
│   ├── components/
│   │   └── layout/         # App Shell (Sidebar Tablet & Bottom Nav HP)
│   ├── db/
│   │   └── db.js           # Konfigurasi Dexie (Tabel Produk, Transaksi, Pengeluaran)
│   ├── lib/
│   │   └── utils.js        # Fungsi utilitas (Format Rupiah, Kalkulasi Hari, FIFO)
│   ├── pages/
│   │   ├── Auth/           # (Segera Hadir) Halaman Serah Terima Shift
│   │   ├── Dashboard/      # Dashboard Laba/Rugi Harian
│   │   ├── Inventory/      # Tabel Manajemen Stok & Barang Baru
│   │   └── POS/            # Halaman Utama Kasir (Keranjang & Grid Produk)
│   ├── store/
│   │   └── useCartStore.js # Zustand Global State untuk Keranjang Belanja
│   ├── App.jsx             # Routing Induk
│   └── index.css           # Tailwind Directives & Font Import
├── PRD.md                  # Dokumen Kebutuhan Produk (Spesifikasi Bisnis)
└── tailwind.config.js      # Kustomisasi Warna & Font (Outfit)
```

---

## ⚙️ Cara Instalasi & Menjalankan Aplikasi

1. **Clone Repositori ini:**
   ```bash
   git clone git@github.com:ahmadhakimitsnaini/kelontong-hub.git
   cd "dashboard kasir"
   ```

2. **Instal Dependensi:**
   Pastikan Anda telah menginstal Node.js, lalu jalankan:
   ```bash
   npm install
   ```

3. **Jalankan *Development Server*:**
   ```bash
   npm run dev
   ```
   Aplikasi dapat diakses di `http://localhost:5173`. Cobalah buka menggunakan fitur *Device Emulation* di browser untuk melihat pengalaman Mobile.

4. **Build untuk Produksi:**
   ```bash
   npm run build
   ```

---

*Dikembangkan dengan standar arsitektur modern untuk merevolusi efisiensi warung tradisional.*
