import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import useAuthStore from './store/useAuthStore'

/**
 * Bootstrap Aplikasi:
 * 1. Panggil restoreSession() SEBELUM render.
 *    Ini memastikan state auth sudah siap sebelum komponen apapun di-render.
 * 2. Supabase akan membaca token dari localStorage (jika ada) dan
 *    mencoba refresh ke server jika online.
 * 3. Setelah selesai (berhasil atau gagal), App di-render.
 *    Komponen App akan membaca `isInitialized` dari store untuk
 *    menampilkan halaman login atau halaman utama.
 */
useAuthStore.getState().restoreSession().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
