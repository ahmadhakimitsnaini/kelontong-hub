# 🏪 MaduraDigital (Kelontong-Hub)

**MaduraDigital** adalah aplikasi Point of Sale (POS) dan manajemen inventaris modern yang dirancang khusus untuk toko kelontong atau "Warung Madura". 

Aplikasi ini dibangun dengan arsitektur **Offline-First** (Dexie.js) yang dipadukan dengan **Cloud Sync** (Supabase), memastikan kasir dapat terus melayani pembeli meskipun koneksi internet terputus, dan data akan disinkronkan otomatis saat online kembali.

---

## 🚀 Fitur Unggulan

1. **🔒 Manajemen Akses Berbasis Peran (RBAC)**
   - **Admin (Pemilik):** Memiliki akses penuh ke Dashboard Laba/Rugi, Pembukuan, Inventaris, dan Manajemen Shift.
   - **Kasir (Pegawai):** Tampilan disederhanakan hanya untuk halaman Kasir (POS), Manajemen Shift, dan Inventaris, menghindari campur tangan terhadap laporan keuangan.

2. **⚡ Kasir Cepat (Quick-Tap POS)**
   - Desain tombol produk yang besar (*thumb-friendly*) untuk layar sentuh, dioptimalkan untuk perangkat *Mobile/Tablet*.
   - Filter kategori pintar dan penghapusan stok instan setelah *checkout*.

3. **⏰ Manajemen Shift & Serah Terima Kasir**
   - Pencatatan "Buka Shift" (modal awal uang laci) dan "Tutup Shift" (perhitungan selisih kas fisik vs sistem).
   - Menghindari kecurangan dengan mencatat identitas akun kasir yang sedang *login* secara otomatis (melalui Supabase Auth).

4. **📦 Inventaris & FIFO Pintar (First In, First Out)**
   - **Indikator Kadaluwarsa Visual:** Barang yang akan segera basi diberi peringatan warna.
   - **Peringatan Stok Menipis:** Angka stok berubah kuning/merah jika hampir habis.

5. **📈 Dashboard Laba/Rugi Real-time**
   - Menghitung **Laba Kotor** otomatis dan mencatat **Pengeluaran Kas** (Bayar listrik, es batu, kuli).
   - Mengkalkulasi **Laba Bersih** harian secara *real-time* dengan visualisasi elegan.

6. **☁️ Offline-First & Background Cloud Sync**
   - Transaksi disimpan seketika di *browser* menggunakan **Dexie.js** (IndexedDB).
   - Pekerja sinkronisasi (*Sync Service*) secara pasif mendeteksi koneksi dan mengirim data ke **Supabase** di latar belakang tanpa mengganggu kasir.

---

## 🛠️ Tech Stack (Teknologi yang Digunakan)

- **Frontend Framework:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v3](https://tailwindcss.com/) (Custom Theme & *Glassmorphism*)
- **Routing & Auth Guard:** React Router v6 + HOC Protected Routes
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) (Keranjang Belanja, Autentikasi, Notifikasi Global)
- **Local Database:** [Dexie.js](https://dexie.org/) (IndexedDB)
- **Backend & Cloud Database:** [Supabase](https://supabase.com/) (PostgreSQL + GoTrue Auth)
- **PWA (Progressive Web App):** *vite-plugin-pwa* (Bisa diinstal sebagai aplikasi *native*)

---

## 📂 Struktur Proyek

```text
├── src/
│   ├── components/
│   │   └── layout/         # App Shell, Sidebar Dinamis, ProtectedRoute, Global Notification
│   ├── db/
│   │   └── db.js           # Konfigurasi Dexie (Tabel Lokal Offline)
│   ├── lib/
│   │   ├── supabase.js     # Klien Koneksi Supabase
│   │   ├── syncService.js  # Mesin Sinkronisasi Latar Belakang (Lokal <-> Cloud)
│   │   └── utils.js        # Fungsi utilitas (Format Rupiah, Kalkulasi Hari, FIFO)
│   ├── pages/
│   │   ├── Auth/           # Halaman Login & Serah Terima Shift (ShiftPage)
│   │   ├── Dashboard/      # Dashboard Laba/Rugi Harian
│   │   ├── Inventory/      # Tabel Manajemen Stok & Barang Baru
│   │   ├── Pembukuan/      # Tabel Riwayat Arus Kas & Export Data
│   │   └── POS/            # Halaman Utama Kasir
│   ├── store/
│   │   ├── useAuthStore.js # Manajemen Sesi, RBAC, dan Login Offline-First
│   │   └── useNotificationStore.js # State Notifikasi Toast Interaktif
│   ├── App.jsx             # Routing Induk & Guard
│   └── index.css           # Tailwind Directives
└── PRD.md                  # Dokumen Kebutuhan Produk (Spesifikasi Bisnis)
```

---

## ⚙️ Cara Instalasi & Menjalankan Aplikasi

### 1. Persiapan Supabase (Backend)
Buat proyek baru di [Supabase](https://supabase.com/) dan siapkan kredensial Anda. Anda wajib membuat file `.env` di folder *root* proyek ini:
```env
VITE_SUPABASE_URL=https://[PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=ey...[ANON-KEY]...
```

*Di dalam Supabase SQL Editor, jalankan perintah SQL untuk membuat tabel `user_profiles` dan trigger fungsi otomatis saat user baru mendaftar (lihat dokumentasi/artefak `supabase_setup_auth.md`).*

### 2. Jalankan Aplikasi Lokal
```bash
# Instal Dependensi
npm install

# Jalankan Development Server
npm run dev
```
Aplikasi dapat diakses di `http://localhost:5173`. 

### 3. Build untuk Produksi (Vercel)
```bash
npm run build
```
*(Catatan: Pastikan Anda menambahkan variabel lingkungan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di Dashboard Vercel Anda sebelum melakukan deploy).*

---

*Dikembangkan dengan standar arsitektur modern untuk merevolusi efisiensi warung tradisional.*
