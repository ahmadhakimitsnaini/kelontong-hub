/**
 * Utility untuk membangkitkan suara (synthesizer) menggunakan Web Audio API.
 * Digunakan untuk umpan balik (feedback) saat barcode di-scan.
 * Menghindari keharusan mendownload atau menyimpan file .mp3.
 */

// Simpan context secara global (lazy initialization)
let audioCtx = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

/**
 * Memainkan bunyi Beep pendek bernada tinggi (Tanda Sukses)
 */
export const playSuccessBeep = () => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine'; // Suara lembut
    oscillator.frequency.setValueAtTime(800, ctx.currentTime); // 800Hz (Nada tinggi)
    oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime); // Volume rendah (tidak bising)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
  } catch (error) {
    console.warn('[AudioUtils] Gagal memainkan success beep:', error);
  }
};

/**
 * Memainkan bunyi Boop panjang bernada rendah (Tanda Gagal/Error)
 */
export const playErrorBeep = () => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sawtooth'; // Suara agak kasar/buzz
    oscillator.frequency.setValueAtTime(200, ctx.currentTime); // 200Hz (Nada rendah)
    oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (error) {
    console.warn('[AudioUtils] Gagal memainkan error beep:', error);
  }
};
