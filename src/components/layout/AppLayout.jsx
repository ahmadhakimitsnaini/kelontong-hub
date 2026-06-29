import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  Clock,
  Menu,
  Wifi,
  WifiOff,
  BookOpen,
  CloudUpload,
  CloudOff,
  Cloud
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../../db/db";
import { syncAllPendingData, getPendingSyncCount } from "../../lib/syncService";
import GlobalNotification from "./GlobalNotification";

const AppLayout = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingCount, setPendingCount] = useState(0);

  // Pantau status koneksi internet untuk fitur Offline Sync
  useEffect(() => {
    const checkPending = async () => {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    };

    const handleOnline = () => {
      setIsOnline(true);
      syncAllPendingData();
    };
    const handleOffline = () => setIsOnline(false);
    const handleSyncComplete = () => checkPending();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("syncCompleted", handleSyncComplete);
    
    // Initial sync & check
    checkPending();
    if (navigator.onLine) {
      syncAllPendingData();
    }
    
    // Polling periodik (setiap 30 detik) untuk mengecek pending data atau memicu sync
    const syncInterval = setInterval(() => {
      checkPending();
      if (navigator.onLine) syncAllPendingData();
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("syncCompleted", handleSyncComplete);
      clearInterval(syncInterval);
    };
  }, []);

  // Update Jam secara real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ambil status shift aktif secara real-time dari database
  const activeShift = useLiveQuery(async () => {
    const shifts = await db.shifts.orderBy('id').reverse().toArray();
    const latest = shifts[0];
    return (latest && !latest.waktu_selesai) ? latest : null;
  });

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // Menu Navigasi
  const navItems = [
    { name: "Kasir", path: "/kasir", icon: ShoppingCart },
    { name: "Inventaris", path: "/inventaris", icon: Package },
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Shift", path: "/shift", icon: Clock },
    { name: "Pembukuan", path: "/pembukuan", icon: BookOpen },
  ];

  return (
    <div className="flex h-screen bg-background text-gray-800 font-sans overflow-hidden">
      <GlobalNotification />
      
      {/* ── SIDEBAR (Tablet / Desktop) ───────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-24 lg:w-64 bg-surface border-r border-gray-100 shadow-sm z-20 print:hidden">
        <div className="p-4 flex items-center justify-center lg:justify-start h-16 border-b border-gray-50">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md shadow-primary-500/30">
            F
          </div>
          <span className="hidden lg:block ml-3 font-bold text-xl tracking-tight text-gray-900">
            Toko <span className="text-primary-500">Podjok</span>
          </span>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-2 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-primary-50 text-primary-600 font-medium"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon
                  className={`w-6 h-6 transition-transform ${isActive ? "scale-110" : "group-hover:scale-110"}`}
                />
                <span className="hidden lg:block">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* ── MAIN CONTENT AREA ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full w-full overflow-hidden relative print:overflow-visible">
        {/* Header Global */}
        <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 md:px-6 z-10 print:hidden">
          <div className="flex items-center gap-3">
            {/* Hanya tampil di Mobile */}
            <div className="md:hidden w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
              F
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 leading-tight">
                Shift Aktif: {activeShift ? <span className="text-primary-600 font-bold">{activeShift.nama_kasir}</span> : <span className="text-red-500 font-bold">Belum Buka Shift</span>}
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                {formattedDate} • <span className="text-gray-700">{formattedTime}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Indikator Cloud / Sync */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                !isOnline
                  ? "bg-red-50 text-red-600 border-red-100"
                  : pendingCount > 0
                  ? "bg-yellow-50 text-yellow-600 border-yellow-100"
                  : "bg-green-50 text-green-600 border-green-100"
              }`}
              title={!isOnline ? "Offline Mode" : pendingCount > 0 ? `${pendingCount} data tertunda` : "Semua tersinkronisasi"}
            >
              {!isOnline ? (
                <CloudOff className="w-4 h-4" />
              ) : pendingCount > 0 ? (
                <CloudUpload className="w-4 h-4 animate-pulse" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {!isOnline 
                  ? "Offline Mode" 
                  : pendingCount > 0 
                  ? `Syncing (${pendingCount})` 
                  : "Cloud Synced"}
              </span>
            </div>
          </div>
        </header>

        {/* Area Konten Utama (Outlet dirender di sini) */}
        <div className="flex-1 overflow-auto bg-background pb-16 md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* ── BOTTOM NAVIGATION (Mobile Only) ────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-100 flex justify-around items-center h-16 px-2 pb-safe z-30 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] print:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                isActive
                  ? "text-primary-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div
                className={`relative p-1 rounded-full transition-all duration-300 ${isActive ? "bg-primary-50" : ""}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "scale-110" : ""}`} />
              </div>
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default AppLayout;
