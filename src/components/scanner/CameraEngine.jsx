import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Wand2, Camera, ChevronLeft, Loader2, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useScannerStore from '../../store/useScannerStore'
import useCartStore from '../../store/useCartStore'
import useNotificationStore from '../../store/useNotificationStore'
import { supabase } from '../../lib/supabase'
import db from '../../db/db'
import { formatRupiah } from '../../lib/utils'
import KulakanQtyModal from './KulakanQtyModal'
import MagicScanResultSheet from './MagicScanResultSheet'

/** ID elemen div tempat html5-qrcode merender video kamera */
const READER_ID = 'smart-scanner-reader'

/** Jeda minimal antar scan barcode yang sama (ms) — mencegah spam scan */
const DEBOUNCE_MS = 2000

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
 *
 * Magic Scan (AI Fallback):
 *  - Capture snapshot dari stream video
 *  - Kirim ke Supabase Edge Function
 *  - Tampilkan hasil prediksi via MagicScanResultSheet
 */
const CameraEngine = () => {
  const navigate = useNavigate()
  const { activeMode, isAutoScan, backToModeSelector, closeScanner } = useScannerStore()
  const addItem = useCartStore((s) => s.addItem)
  const { showAlert } = useNotificationStore()

  // ── Refs ────────────────────────────────────────────────────────────────────
  const scannerRef = useRef(null)        // Instance Html5Qrcode
  const lastCodeRef = useRef(null)       // Barcode terakhir yang diproses
  const lastTimeRef = useRef(0)          // Timestamp scan terakhir
  const videoRef = useRef(null)          // Elemen <video> (untuk snapshot)
  const isMountedRef = useRef(true)      // Mencegah setState setelah unmount

  // ── State UI ────────────────────────────────────────────────────────────────
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastScannedName, setLastScannedName] = useState(null)  // Feedback scan sukses
  const [isPaused, setIsPaused] = useState(false)               // Scanner dijeda (kulakan)
  const [isMagicLoading, setIsMagicLoading] = useState(false)   // Loading AI

  // ── State Sub-Modal ──────────────────────────────────────────────────────────
  const [kulakanProduct, setKulakanProduct] = useState(null)    // Produk yang akan di-restock
  const [magicResults, setMagicResults] = useState(null)        // Hasil prediksi AI

  // ── Label Mode ──────────────────────────────────────────────────────────────
  const modeLabels = {
    PENJUALAN: { label: 'Penjualan', color: 'bg-emerald-500', textColor: 'text-emerald-100' },
    KULAKAN: { label: 'Kulakan', color: 'bg-blue-500', textColor: 'text-blue-100' },
    PRODUK_BARU: { label: 'Produk Baru', color: 'bg-violet-500', textColor: 'text-violet-100' },
  }
  const currentMode = modeLabels[activeMode] || modeLabels.PENJUALAN

  // ── Fungsi Routing: Proses Barcode Sesuai Mode ───────────────────────────────
  const processBarcode = useCallback(async (barcode) => {
    if (isProcessing) return

    // ── Anti-spam Debounce ──────────────────────────────────────────────────
    const now = Date.now()
    if (barcode === lastCodeRef.current && now - lastTimeRef.current < DEBOUNCE_MS) return
    lastCodeRef.current = barcode
    lastTimeRef.current = now

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
        // ── Mode Kulakan: Jeda scanner, tampilkan input qty ─────────────────
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
  }, [activeMode, isProcessing, addItem, showAlert, navigate, closeScanner])

  // ── Inisialisasi & Cleanup Kamera ───────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true
    let html5QrCode = null

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(READER_ID, { verbose: false })
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: 'environment' }, // Gunakan kamera belakang
          {
            fps: 10,
            aspectRatio: 1.7778, // Memaksa kamera ke rasio 16:9 agar memenuhi layar HP modern
            // qrbox dihapus: sehingga area scan menjadi FULL FRAME (seluruh layar),
            // pengguna tidak perlu membidik tepat di tengah kotak.
          },
          (decodedText) => {
            // onScanSuccess: dipanggil setiap kali barcode terdeteksi
            if (!isAutoScan) return // Manual mode: abaikan scan otomatis
            processBarcode(decodedText)
          },
          () => {
            // onScanFailure: diabaikan (normal, frame tanpa barcode)
          }
        )

        // Simpan referensi elemen video untuk keperluan snapshot (Magic Scan)
        const videoEl = document.querySelector(`#${READER_ID} video`)
        if (videoEl) videoRef.current = videoEl

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
  // Intentionally tidak include processBarcode & isAutoScan agar tidak restart kamera

  // ── Tombol Capture Manual (Mode isAutoScan = false) ─────────────────────────
  const handleManualCapture = () => {
    if (!scannerRef.current || isPaused) return
    scannerRef.current.getRunningTrackCapabilities()
      .then(() => {
        // Ambil frame terakhir yang sudah dianalisa
        // html5-qrcode tidak expose manual capture, kita pakai canvas snapshot
        captureSnapshot()
      })
      .catch(console.error)
  }

  // ── Snapshot Kamera untuk Magic Scan ─────────────────────────────────────────
  const captureSnapshot = () => {
    const video = videoRef.current
    if (!video) return null

    // Optimasi: Resize gambar agar tidak terlalu besar (Mencegah Payload Too Large / Timeout)
    const MAX_WIDTH = 800
    let width = video.videoWidth
    let height = video.videoHeight

    if (width > MAX_WIDTH) {
      height = Math.floor(height * (MAX_WIDTH / width))
      width = MAX_WIDTH
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, width, height)
    
    // Kompresi JPEG ke kualitas 60%
    return canvas.toDataURL('image/jpeg', 0.6)
  }

  // ── Magic Scan: Kirim gambar ke AI ──────────────────────────────────────────
  const handleMagicScan = async () => {
    const base64Image = captureSnapshot()
    if (!base64Image) {
      showAlert('Kamera belum siap, coba lagi.', 'error')
      return
    }

    setIsMagicLoading(true)
    setIsPaused(true)

    try {
      // Ambil katalog dari Dexie (Offline-first approach)
      // Hanya kirim field penting agar payload hemat kuota
      const allProducts = await db.products.toArray()
      const catalog = allProducts.map(p => ({
        id: p.id,
        nama: p.nama,
        kategori: p.kategori,
        harga_jual: p.harga_jual
      }))

      const { data, error } = await supabase.functions.invoke('analyze-product-image', {
        body: { image: base64Image, catalog },
      })

      if (error) {
        console.error('[MagicScan] Edge Function Error:', error)
        throw new Error(error.message || 'Gagal terhubung ke Edge Function')
      }

      if (data?.error) {
        console.error('[MagicScan] Server Logic Error:', data.error)
        throw new Error(data.error)
      }

      if (data?.results && data.results.length > 0) {
        setMagicResults(data.results)
      } else {
        showAlert('AI tidak dapat mengenali produk ini. Coba scan barcode atau foto lebih jelas.', 'error')
        setIsPaused(false)
      }
    } catch (err) {
      console.error('[MagicScan] Detail Error Lengkap:', err)
      showAlert(`Gagal: ${err.message || 'Periksa koneksi internet Anda.'}`, 'error')
      setIsPaused(false)
    } finally {
      setIsMagicLoading(false)
    }
  }

  // ── Callback: Konfirmasi Magic Scan (AI) ───────────────────────────────────
  const handleMagicScanConfirm = (product) => {
    setMagicResults(null)
    if (activeMode === 'KASIR') {
      addItem({ ...product, qty: 1 })
      showAlert(`✓ ${product.nama} ditambahkan dari Magic Scan`, 'success')
      setLastScannedName(product.nama)
      setTimeout(() => setLastScannedName(''), 2000)
      setIsPaused(false)
    } else if (activeMode === 'KULAKAN') {
      if (product.id === 'NEW') {
        showAlert('Barang belum ada di database. Silakan tambah di Produk Baru terlebih dahulu.', 'error')
        setIsPaused(false)
        return
      }
      setKulakanProduct(product)
      setIsPaused(true)
    } else if (activeMode === 'PRODUK_BARU') {
      closeScanner()
      if (product.id === 'NEW') {
        // Jika AI menebak barang baru, kirim tebakannya ke form
        navigate(`/inventaris?magic_name=${encodeURIComponent(product.nama)}&magic_category=${encodeURIComponent(product.kategori)}`)
      } else {
        // Jika AI ternyata menemukan barang tersebut di katalog
        navigate(`/inventaris?barcode=magic_scan_${product.id}`)
      }
    }
  }

  // ── Callback: Konfirmasi qty Kulakan ─────────────────────────────────────────
  const handleKulakanConfirm = async (qty) => {
    if (!kulakanProduct || qty <= 0) return

    try {
      const currentStok = kulakanProduct.stok_gudang || 0
      await db.products.update(kulakanProduct.id, {
        stok_gudang: currentStok + qty,
      })
      showAlert(`✓ Stok ${kulakanProduct.nama} +${qty} (Gudang: ${currentStok + qty})`, 'success')
    } catch (err) {
      console.error('[Kulakan] Gagal update stok:', err)
      showAlert('Gagal memperbarui stok.', 'error')
    } finally {
      setKulakanProduct(null)
      setIsProcessing(false)
      setIsPaused(false)
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
            <div className="relative w-[85%] max-w-sm aspect-[4/3] rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
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

              {/* Tombol Magic Scan (AI) */}
              <button
                id="magic-scan-btn"
                onClick={handleMagicScan}
                disabled={isMagicLoading || isPaused}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  isMagicLoading
                    ? 'bg-violet-400 cursor-wait'
                    : isPaused
                    ? 'bg-white/10 cursor-not-allowed'
                    : 'bg-violet-500/80 hover:bg-violet-500 active:scale-95'
                } backdrop-blur-sm`}>
                  {isMagicLoading
                    ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                    : <Wand2 className="w-6 h-6 text-white" />
                  }
                </div>
                <span className="text-white/70 text-[10px] font-medium">Magic Scan</span>
              </button>

              {/* Tombol Capture Manual (Hanya saat isAutoScan = false) */}
              {!isAutoScan && (
                <button
                  id="manual-capture-btn"
                  onClick={() => {
                    // Paksa proses frame saat ini
                    if (videoRef.current) {
                      const canvas = document.createElement('canvas')
                      canvas.width = videoRef.current.videoWidth
                      canvas.height = videoRef.current.videoHeight
                      canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
                      // html5-qrcode internal decode tidak bisa dipanggil langsung,
                      // gunakan scan from canvas
                    }
                  }}
                  disabled={isPaused}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all ${
                    isPaused ? 'opacity-40' : 'active:scale-95 hover:bg-white/10'
                  }`}>
                    <div className="w-14 h-14 rounded-full bg-white" />
                  </div>
                  <span className="text-white/70 text-[10px] font-medium">Capture</span>
                </button>
              )}

              {/* Auto-Scan Indicator */}
              {isAutoScan && (
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
              )}

            </div>

            <p className="text-center text-white/40 text-xs mt-4">
              {isAutoScan
                ? 'Arahkan kamera ke barcode produk'
                : 'Tekan Capture saat barcode dalam frame'}
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
        }}
      />

      {/* ── Sub-Modal: Hasil Magic Scan AI ────────────────────────────────── */}
      <MagicScanResultSheet
        results={magicResults}
        activeMode={activeMode}
        onConfirm={handleMagicScanConfirm}
        onCancel={() => {
          setMagicResults(null)
          setIsPaused(false)
        }}
      />
    </motion.div>
  )
}

export default CameraEngine
