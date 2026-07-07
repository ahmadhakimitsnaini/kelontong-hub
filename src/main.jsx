import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary'
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
 *
 * PENTING: Menggunakan .catch().finally() agar React SELALU di-render,
 * bahkan jika restoreSession() gagal total (misal: error jaringan).
 * Tanpa ini, layar akan blank putih selamanya jika terjadi exception.
 */
const renderApp = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

useAuthStore.getState().restoreSession()
  .catch((err) => {
    console.error('[Bootstrap] Gagal restore session:', err)
  })
  .finally(() => {
    renderApp()
  })
