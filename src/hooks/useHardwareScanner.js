import { useEffect, useRef } from 'react';

/**
 * Hook untuk mendeteksi input dari Physical Barcode Scanner (Keyboard Wedge).
 *
 * @param {Function} onScan - Callback yang dijalankan ketika barcode lengkap diterima.
 * @param {Object} options - Konfigurasi opsional.
 * @param {boolean} options.enabled - Mengaktifkan/menonaktifkan scanner (default: true).
 */
export const useHardwareScanner = (onScan, { enabled = true } = {}) => {
  const buffer = useRef('');
  const lastKeyTime = useRef(Date.now());
  const pendingScan = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // 1. Hindari tabrakan dengan input manual
      // Jika kursor user ada di dalam input/textarea, biarkan event native berjalan
      if (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      ) {
        return;
      }

      // Jangan tangkap kombinasi tombol seperti Ctrl+C, Alt+Tab, dll
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const currentTime = Date.now();
      
      // 2. Deteksi Kecepatan Ketikan (Hardware Scanner itu instan/sangat cepat)
      // Jika jeda lebih dari 50ms (kasarannya limit orang ngetik normal), reset buffer
      if (currentTime - lastKeyTime.current > 50) {
        buffer.current = '';
      }

      // 3. Proses Karakter
      if (e.key === 'Enter') {
        // Scanner selalu mengirim "Enter" setelah barcode selesai.
        // Cek jika panjang buffer valid (barcode umumnya minimal 4-5 karakter)
        if (buffer.current.length > 3 && !pendingScan.current) {
          const scannedCode = buffer.current;
          
          // Anti-double-scan: Jangan izinkan scan berulang terlalu cepat (debounce 300ms)
          pendingScan.current = true;
          setTimeout(() => {
            pendingScan.current = false;
          }, 300);

          onScan(scannedCode);
        }
        buffer.current = '';
        e.preventDefault(); // Cegah default behaviour enter (karena targetnya body/document)
      } else if (e.key.length === 1) {
        // Hanya tambahkan karakter tunggal yang terlihat (angka/huruf)
        buffer.current += e.key;
      }

      // Update timer untuk karakter berikutnya
      lastKeyTime.current = currentTime;
    };

    // Gunakan 'keydown' pada window untuk menangkap semua event secara global
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, enabled]);
};

export default useHardwareScanner;
