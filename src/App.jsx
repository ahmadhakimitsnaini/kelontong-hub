import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LoginPage from './pages/Auth/LoginPage'
import POSPage from './pages/POS/POSPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import InventoryPage from './pages/Inventory/InventoryPage'
import ShiftPage from './pages/Auth/ShiftPage'
import PembukuanPage from './pages/Pembukuan/PembukuanPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rute Publik */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rute yang dilindungi (Harus Login) */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'kasir']} />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/kasir" replace />} />
            
            {/* Bisa diakses Admin & Kasir */}
            <Route path="/kasir" element={<POSPage />} />
            <Route path="/shift" element={<ShiftPage />} />
            <Route path="/inventaris" element={<InventoryPage />} />
            
            {/* Rute khusus Admin (akan dilindungi tambahan di dalam AppLayout nanti, tapi untuk perlindungan hard-route:) */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pembukuan" element={<PembukuanPage />} />
            </Route>
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
