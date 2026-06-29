import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isLoggedIn, getRole, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn()) {
    // Redirect ke login jika belum auth
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const role = getRole();

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Jika role tidak diizinkan, redirect ke halaman default (misal POS untuk kasir)
    return <Navigate to="/kasir" replace />;
  }

  // Jika aman, render child components (biasanya AppLayout)
  return <Outlet />;
};

export default ProtectedRoute;
