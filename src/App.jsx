import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import POSPage from './pages/POS/POSPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import InventoryPage from './pages/Inventory/InventoryPage'
import ShiftPage from './pages/Auth/ShiftPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root ke halaman Kasir (POS) sebagai halaman utama */}
        <Route path="/" element={<Navigate to="/kasir" replace />} />

        {/* Halaman Kasir (POS) — Halaman utama untuk Staff */}
        <Route path="/kasir" element={<POSPage />} />

        {/* Halaman Dashboard Laba/Rugi — Untuk Owner */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Halaman Inventaris & FIFO Pintar */}
        <Route path="/inventaris" element={<InventoryPage />} />

        {/* Halaman Manajemen Shift & Pengeluaran */}
        <Route path="/shift" element={<ShiftPage />} />

        {/* Fallback: Redirect ke Kasir jika URL tidak dikenal */}
        <Route path="*" element={<Navigate to="/kasir" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
