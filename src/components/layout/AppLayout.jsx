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
  Cloud,
  LogOut,
  UserCircle2,
  ScanLine,
  Boxes,
  ChevronDown,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "../../db/db";
import { syncAllPendingData, getPendingSyncCount } from "../../lib/syncService";
import GlobalNotification from "./GlobalNotification";
import useAuthStore from "../../store/useAuthStore";
import SmartScannerModal from "../scanner/SmartScannerModal";
import useScannerStore from "../../store/useScannerStore";

const AppLayout = () => {
  const { openScanner } = useScannerStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingCount, setPendingCount] = useState(0);

  const { isKasir, getFullName, getRole, logout } = useAuthStore();
  const [openDropdowns, setOpenDropdowns] = useState({});

  const toggleDropdown = (e, name) => {
    e.preventDefault(); // Mencegah pindah halaman jika cuma ingin buka dropdown
    setOpenDropdowns((prev) => ({ ...prev, [name]: !prev[name] }));
  };

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
    const shifts = await db.shifts.orderBy("id").reverse().toArray();
    const latest = shifts[0];
    return latest && !latest.waktu_selesai ? latest : null;
  });

  // Hitung jumlah pengajuan Inbound yang PENDING (untuk badge notifikasi Admin)
  const pendingInboundCount = useLiveQuery(
    () => db.inbound_logs.where('status').equals('PENDING').count(),
    []
  ) || 0;

  const formattedDate = currentTime.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Menu Navigasi Dasar
  const baseNavItems = [
    { name: "Kasir", path: "/kasir", icon: ShoppingCart },
    {
      name: "Inventory",
      path: "/inventory",
      icon: Boxes,
      badge: pendingInboundCount > 0 && !isKasir() ? pendingInboundCount : null,
      children: [
        { name: "Master Barang", path: "/inventory/master" },
        { name: "Inbound", path: "/inventory/inbound" },
        { name: "Persetujuan Inbound", path: "/inventory/approval", adminOnly: true, badge: pendingInboundCount > 0 ? pendingInboundCount : null },
      ],
    },
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Shift", path: "/shift", icon: Clock },
    { name: "Pembukuan", path: "/pembukuan", icon: BookOpen },
  ];

  // Filter Menu: Jika Kasir, hilangkan menu dan sub-menu khusus Admin
  const navItems = baseNavItems.map(item => {
    if (item.children) {
      return {
        ...item,
        children: item.children.filter(child => !(isKasir() && child.adminOnly))
      };
    }
    return item;
  }).filter((item) => {
    if (isKasir() && (item.name === "Dashboard" || item.name === "Pembukuan")) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen bg-background text-gray-800 font-sans overflow-hidden">
      <GlobalNotification />

      {/* ── SMART SCANNER MODAL (Global, tersedia di semua halaman) ─── */}
      <SmartScannerModal />

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

        <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(item.path + "/");
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openDropdowns[item.name] || isActive;

            return (
              <div key={item.path} className="flex flex-col">
                {hasChildren ? (
                  <div
                    onClick={(e) => toggleDropdown(e, item.name)}
                    className={`flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 group ${
                      isActive
                        ? "bg-primary-50 text-primary-600 font-medium"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Icon className={`w-6 h-6 transition-transform ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                        {item.badge && (
                          <span className="absolute -top-1 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-surface animate-bounce">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="hidden lg:block">{item.name}</span>
                    </div>
                    <ChevronDown className={`hidden lg:block w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                ) : (
                  <NavLink
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
                )}

                {/* Sub Menu / Dropdown Children */}
                {hasChildren && isOpen && (
                  <div className="hidden lg:flex flex-col ml-9 mt-1 gap-1 border-l-2 border-gray-100 pl-3">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive: isChildActive }) =>
                          `px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                            isChildActive
                              ? "text-primary-600 font-medium bg-primary-50"
                              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                          }`
                        }
                      >
                        {child.name}
                        {child.badge && (
                           <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                             {child.badge}
                           </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Tombol Scan di Sidebar Desktop */}
          <button
            id="sidebar-scan-btn"
            onClick={openScanner}
            className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group bg-primary-500 hover:bg-primary-600 text-white mt-2 shadow-lg shadow-primary-500/30 active:scale-95"
          >
            <ScanLine className="w-6 h-6 transition-transform group-hover:scale-110" />
            <span className="hidden lg:block font-semibold">Scan Barang</span>
          </button>
        </nav>

        {/* Profil User & Logout (Sidebar Bottom) */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="hidden lg:flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <UserCircle2 className="w-5 h-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">
                {getFullName()}
              </p>
              <p className="text-[10px] uppercase font-bold text-primary-600 tracking-wider">
                {getRole()}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 mx-auto lg:mx-0"
            title="Keluar (Logout)"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
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
                Shift Aktif:{" "}
                {activeShift ? (
                  <span className="text-primary-600 font-bold">
                    {activeShift.nama_kasir}
                  </span>
                ) : (
                  <span className="text-red-500 font-bold">
                    Belum Buka Shift
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                {formattedDate} •{" "}
                <span className="text-gray-700">{formattedTime}</span>
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
              title={
                !isOnline
                  ? "Offline Mode"
                  : pendingCount > 0
                    ? `${pendingCount} data tertunda`
                    : "Semua tersinkronisasi"
              }
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
        {/* Render nav items dengan slot kosong di tengah untuk tombol Scan FAB */}
        {(() => {
          const half = Math.ceil(navItems.length / 2);
          const leftItems = navItems.slice(0, half);
          const rightItems = navItems.slice(half);

          const renderNavItem = (item) => {
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
          };

          return (
            <>
              {leftItems.map(renderNavItem)}

              {/* ── Tombol Scan FAB (Floating Action Button) ── */}
              <button
                id="mobile-scan-fab"
                onClick={openScanner}
                className="relative flex flex-col items-center justify-center w-full h-full gap-1 group"
              >
                {/* FAB Circle */}
                <div className="-mt-6 w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center shadow-xl shadow-primary-500/40 border-4 border-white transition-all group-active:scale-90 group-hover:bg-primary-600">
                  <ScanLine className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] font-medium text-primary-600">
                  Scan
                </span>
              </button>

              {rightItems.map(renderNavItem)}
            </>
          );
        })()}
      </nav>
    </div>
  );
};

export default AppLayout;
