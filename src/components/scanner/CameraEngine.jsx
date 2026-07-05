import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { X, Camera, ChevronLeft, Loader2, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useScannerStore from '../../store/useScannerStore'
import useCartStore from '../../store/useCartStore'
import useNotificationStore from '../../store/useNotificationStore'
import db from '../../db/db'
import { formatRupiah } from '../../lib/utils'
import KulakanQtyModal from './KulakanQtyModal'

/** ID elemen div tempat html5-qrcode merender video kamera */
const READER_ID = 'smart-scanner-reader'

/** Jeda minimal antar scan barcode yang sama (ms) — mencegah spam scan */
const DEBOUNCE_MS = 800

/**
 * CameraEngine
 *
 * Komponen inti yang menginisialisasi kamera menggunakan html5-qrcode,
 * mengelola siklus hidup scanner (start → stop → cleanup),
 * dan merutekan hasil scan berdasarkan activeMode.
 *
 * Logika Routing:
 *  - PENJUALAN  → cari produk di Dexie → addItem ke CartStore
 *  - KULAKAN    → cari produk → tampilkan KulakanQtyModal → update stok Dexie
 *  - PRODUK_BARU → redirect ke /inventaris?barcode=XXX
 */
const CameraEngine = () => {
  const navigate = useNavigate()
  const { activeMode, backToModeSelector, closeScanner } = useScannerStore()
  const addItem = useCartStore((s) => s.addItem)
  const { showAlert } = useNotificationStore()

  // ── Refs ────────────────────────────────────────────────────────────────────
  const scannerRef = useRef(null)        // Instance Html5Qrcode
  const lastCodeRef = useRef(null)       // Barcode terakhir yang diproses
  const lastTimeRef = useRef(0)          // Timestamp scan terakhir
  const isMountedRef = useRef(true)      // Mencegah setState setelah unmount

  // ── State UI ────────────────────────────────────────────────────────────────
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastScannedName, setLastScannedName] = useState(null)  // Feedback scan sukses
  const [isPaused, setIsPaused] = useState(false)               // Scanner dijeda (kulakan)

  // ── State Sub-Modal ──────────────────────────────────────────────────────────
  const [kulakanProduct, setKulakanProduct] = useState(null)    // Produk yang akan di-restock

  // ── Label Mode ──────────────────────────────────────────────────────────────
  const modeLabels = {
    PENJUALAN: { label: 'Penjualan', color: 'bg-emerald-500', textColor: 'text-emerald-100' },
    KULAKAN: { label: 'Kulakan', color: 'bg-blue-500', textColor: 'text-blue-100' },
    PRODUK_BARU: { label: 'Produk Baru', color: 'bg-violet-500', textColor: 'text-violet-100' },
  }
  const currentMode = modeLabels[activeMode] || modeLabels.PENJUALAN

  // ── Haptic Feedback: Getaran singkat saat scan berhasil ────────────────────
  const triggerHaptic = useCallback(() => {
    try { navigator?.vibrate?.(80) } catch (e) { /* Tidak semua browser mendukung */ }
  }, [])

  // ── Fungsi Routing: Proses Barcode Sesuai Mode ───────────────────────────────
  const processBarcode = useCallback(async (barcode) => {
    // 1. Validasi Pola: Hanya proses teks berisi angka murni (8-14 digit)
    if (!/^\d{8,14}$/.test(barcode)) return

    if (isProcessing) return

    // ── Anti-spam Debounce ──────────────────────────────────────────────────
    const now = Date.now()
    if (barcode === lastCodeRef.current && now - lastTimeRef.current < DEBOUNCE_MS) return
    lastCodeRef.current = barcode
    lastTimeRef.current = now

    // ── Haptic: Getaran konfirmasi instan ───────────────────────────────────
    triggerHaptic()

    setIsProcessing(true)

    try {
      if (activeMode === 'PRODUK_BARU') {
        // ── Mode Produk Baru: Langsung redirect ────────────────────────────
        closeScanner()
        navigate(`/inventaris?barcode=${encodeURIComponent(barcode)}`)
        return
      }

      // ── Cari Produk di Database Lokal (Dexie) ──────────────────────────────
      const product = await db.products.where('barcode').equals(barcode).first()

      if (!product) {
        showAlert(`Barcode "${barcode}" tidak ditemukan di database.`, 'error')
        setIsProcessing(false)
        return
      }

      if (activeMode === 'PENJUALAN') {
        // ── Mode Penjualan: Tambah ke Keranjang ────────────────────────────
        addItem(product)
        if (isMountedRef.current) {
          setLastScannedName(product.nama)
          setTimeout(() => {
            if (isMountedRef.current) setLastScannedName(null)
          }, 2000)
        }

      } else if (activeMode === 'KULAKAN') {
        // ── Mode Kulakan: Jeda scanner (hardware), tampilkan input qty ──────
        try { scannerRef.current?.pause(true) } catch (e) {}
        setIsPaused(true)
        setKulakanProduct(product)
      }

    } catch (err) {
      console.error('[CameraEngine] processBarcode error:', err)
      showAlert('Terjadi kesalahan saat memproses barcode.', 'error')
    } finally {
      if (isMountedRef.current && activeMode !== 'KULAKAN') {
        setIsProcessing(false)
      }
    }
  }, [activeMode, isProcessing, addItem, showAlert, navigate, closeScanner, triggerHaptic])

  // ── Inisialisasi & Cleanup Kamera ───────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true
    let html5QrCode = null

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(READER_ID, { 
          verbose: false,
          // 2. Pembatasan Format: Hanya deteksi barcode ritel (mengabaikan QR Code dll)
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128
          ]
        })
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: 'environment' }, // Gunakan kamera belakang
          {
            fps: 15,
            aspectRatio: 1.7778, // Memaksa kamera ke rasio 16:9 agar memenuhi layar HP modern
            // 3. Area Pindai (qrbox): Persegi panjang horizontal agar lebih fokus & ringan
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              return {
                width: viewfinderWidth * 0.85,
                height: 150
              }
            }
          },
          (decodedText) => {
            // onScanSuccess: dipanggil setiap kali barcode terdeteksi
            processBarcode(decodedText)
          },
          () => {
            // onScanFailure: diabaikan (normal, frame tanpa barcode)
          }
        )

        if (isMountedRef.current) setIsCameraReady(true)

      } catch (err) {
        console.error('[CameraEngine] Gagal start kamera:', err)
        if (isMountedRef.current) {
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.'
              : 'Gagal mengakses kamera. Pastikan tidak ada aplikasi lain yang menggunakan kamera.'
          )
        }
      }
    }

    startScanner()

    // ── CLEANUP: Wajib stop scanner saat komponen unmount ────────────────────
    return () => {
      isMountedRef.current = false
      if (scannerRef.current) {
        try {
          // html5-qrcode getState(): 1 = NOT_STARTED, 2 = SCANNING, 3 = PAUSED
          const state = scannerRef.current.getState?.()
          
          if (state === 2 || state === 3) {
            scannerRef.current.stop()
              .then(() => {
                try { scannerRef.current.clear() } catch(e) {}
              })
              .catch(() => {
                // Abaikan error promise saat unmount
              })
          } else {
            // Jika belum running, langsung clear saja
            try { scannerRef.current.clear() } catch(e) {}
          }
        } catch (err) {
          console.warn('[CameraEngine] Error during cleanup:', err)
        }
        scannerRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally tidak include processBarcode agar tidak restart kamera


  // ── Callback: Konfirmasi qty Kulakan ─────────────────────────────────────────
  const handleKulakanConfirm = async (qty) => {
    if (!kulakanProduct || qty <= 0) return

    try {
      const currentStok = kulakanProduct.stok || 0
      await db.products.update(kulakanProduct.id, {
        stok: currentStok + qty,
      })
      showAlert(`✓ Stok ${kulakanProduct.nama} +${qty} (Gudang: ${currentStok + qty})`, 'success')
    } catch (err) {
      console.error('[Kulakan] Gagal update stok:', err)
      showAlert('Gagal memperbarui stok.', 'error')
    } finally {
      setKulakanProduct(null)
      setIsProcessing(false)
      setIsPaused(false)
      // Resume hardware scanner setelah kulakan selesai
      try { scannerRef.current?.resume() } catch (e) {}
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black flex flex-col"
    >
      {/* ── Elemen div Target Scanner ─────────────────────────────────────── */}
      {/* html5-qrcode akan inject elemen video ke dalam div ini */}
      <div
        id={READER_ID}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: isCameraReady ? 1 : 0 }}
      />

      {/* ── Loading Spinner (Sebelum kamera siap) ──────────────────────────── */}
      {!isCameraReady && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
          <p className="text-white/70 text-sm">Menyalakan kamera...</p>
        </div>
      )}

      {/* ── Error State ─────────────────────────────────────────────────────── */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-8 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <Camera className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-white font-semibold text-lg">Kamera Tidak Bisa Diakses</p>
          <p className="text-gray-400 text-sm leading-relaxed">{cameraError}</p>
          <button
            onClick={closeScanner}
            className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-colors"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ── Overlay UI (Di atas kamera, saat kamera sudah siap) ────────────── */}
      {isCameraReady && (
        <>
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-12 pb-4 bg-gradient-to-b from-black/70 to-transparent">
            <button
              onClick={backToModeSelector}
              className="flex items-center gap-1 text-white/90 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Kembali</span>
            </button>

            {/* Badge Mode Aktif */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${currentMode.color} ${currentMode.textColor}`}>
              {currentMode.label}
            </div>

            <button
              onClick={closeScanner}
              className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Viewfinder / Crosshair (UI Baru Lebih Besar) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden">
            <div className="relative w-[85%] h-[150px] rounded-3xl">
              {/* Efek scan line animasi */}
              {!isPaused && (
                <motion.div
                  className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80 z-20"
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Corner brackets */}
              {['tl', 'tr', 'bl', 'br'].map((pos) => (
                <div
                  key={pos}
                  className={`absolute w-12 h-12 z-20 ${
                    pos === 'tl' ? 'top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl' :
                    pos === 'tr' ? 'top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl' :
                    pos === 'bl' ? 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl' :
                    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl'
                  } border-white shadow-sm`}
                />
              ))}

              {/* Status: Dijeda */}
              {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                  <p className="text-white text-xs font-semibold">Scanner dijeda</p>
                </div>
              )}
            </div>
          </div>

          {/* Toast Feedback Scan Sukses */}
          <AnimatePresence>
            {lastScannedName && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-28 left-4 right-4 z-20 bg-emerald-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs opacity-80 font-medium">Ditambahkan ke keranjang</p>
                  <p className="font-bold text-sm truncate">{lastScannedName}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pb-10 pt-4 px-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-center gap-5">

              {/* Auto-Scan Indicator */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-3 h-3 rounded-full bg-emerald-400"
                  />
                </div>
                <span className="text-white/70 text-[10px] font-medium">Auto Scan</span>
              </div>

            </div>

            <p className="text-center text-white/40 text-xs mt-4">
              Arahkan kamera ke barcode produk
            </p>
          </div>
        </>
      )}

      {/* ── Sub-Modal: Input Qty Kulakan ──────────────────────────────────── */}
      <KulakanQtyModal
        product={kulakanProduct}
        onConfirm={handleKulakanConfirm}
        onCancel={() => {
          setKulakanProduct(null)
          setIsProcessing(false)
          setIsPaused(false)
          // Resume hardware scanner saat user membatalkan kulakan
          try { scannerRef.current?.resume() } catch (e) {}
        }}
      />


    </motion.div>
  )
}

export default CameraEngine
