/**
 * useAuthStore.js
 *
 * Store Zustand untuk manajemen autentikasi berbasis Supabase Auth.
 *
 * Strategi Offline-First:
 * - Saat login berhasil, session dan profil user disimpan ke localStorage.
 * - Saat aplikasi dibuka (bahkan tanpa internet), `restoreSession()` akan
 *   membaca cache lokal terlebih dahulu sebelum mencoba ke server.
 * - Jika ada internet, Supabase secara otomatis me-refresh token di latar belakang.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { pullFromSupabase, subscribeToRealtime, unsubscribeRealtime } from '../lib/syncService'

// ── KONSTANTA KEY UNTUK LOCALSTORAGE ─────────────────────────────────────────
const SESSION_CACHE_KEY = 'auth_session_cache'
const PROFILE_CACHE_KEY = 'auth_profile_cache'

// ── HELPER: Simpan & Baca dari localStorage ───────────────────────────────────
const saveToCache = (session, profile) => {
  try {
    if (session) localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session))
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } catch (e) {
    console.warn('[Auth] Gagal menyimpan session ke cache:', e)
  }
}

const loadFromCache = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_CACHE_KEY))
    const profile = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY))
    return { session, profile }
  } catch (e) {
    console.warn('[Auth] Gagal membaca session dari cache:', e)
    return { session: null, profile: null }
  }
}

const clearCache = () => {
  localStorage.removeItem(SESSION_CACHE_KEY)
  localStorage.removeItem(PROFILE_CACHE_KEY)
}

// ── ZUSTAND STORE ─────────────────────────────────────────────────────────────
const useAuthStore = create((set, get) => ({

  // ── STATE ────────────────────────────────────────────────────────────────
  user: null,       // Data profil user: { id, email, full_name, role }
  session: null,    // Raw Supabase session object
  isLoading: true,  // true saat proses cek/restore session berlangsung
  isInitialized: false, // true setelah restoreSession() selesai dijalankan

  // ── ACTIONS ──────────────────────────────────────────────────────────────

  /**
   * restoreSession — Dipanggil SATU KALI saat aplikasi pertama dibuka.
   *
   * Alur:
   * 1. Coba restore dari Supabase (online) untuk mendapat token terbaru.
   * 2. Jika gagal/offline, fallback ke cache localStorage.
   * 3. Jika session valid (dari manapun), ambil profil user.
   * 4. Set `isInitialized = true` agar app bisa render halaman yang tepat.
   */
  restoreSession: async () => {
    set({ isLoading: true })
    try {
      // Langkah 1: Coba dapatkan session aktif dari Supabase
      const { data: { session }, error } = await supabase.auth.getSession()

      if (session) {
        // Online & session valid — ambil profil terbaru dari server
        const profile = await get()._fetchProfile(session.user.id)
        saveToCache(session, profile)
        set({ session, user: { ...session.user, ...profile } })

        // Tarik semua data dari cloud ke IndexedDB (Sinkronisasi awal)
        pullFromSupabase()
        
        // Aktifkan koneksi WebSocket (Realtime)
        subscribeToRealtime()
      } else {
        // Tidak ada session dari server (offline atau belum login)
        // Coba fallback ke cache lokal
        const { session: cachedSession, profile: cachedProfile } = loadFromCache()
        if (cachedSession && cachedProfile) {
          console.log('[Auth] Offline mode: menggunakan session dari cache lokal.')
          set({ session: cachedSession, user: { ...cachedSession.user, ...cachedProfile } })
        } else {
          // Tidak ada cache — user memang belum pernah login
          set({ session: null, user: null })
        }
      }
    } catch (err) {
      // Jika terjadi error jaringan (offline), coba cache
      console.warn('[Auth] Error saat restore session, mencoba cache:', err.message)
      const { session: cachedSession, profile: cachedProfile } = loadFromCache()
      if (cachedSession && cachedProfile) {
        set({ session: cachedSession, user: { ...cachedSession.user, ...cachedProfile } })
      } else {
        set({ session: null, user: null })
      }
    } finally {
      set({ isLoading: false, isInitialized: true })
    }
  },

  /**
   * login — Autentikasi user dengan email & password via Supabase Auth.
   * Mengembalikan objek { success: boolean, error: string | null }
   */
  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Terjemahkan pesan error Supabase ke Bahasa Indonesia
        const errorMap = {
          'Invalid login credentials': 'Email atau password salah. Coba lagi.',
          'Email not confirmed': 'Email belum dikonfirmasi. Cek inbox Anda.',
          'Too many requests': 'Terlalu banyak percobaan. Tunggu beberapa menit.',
        }
        const friendlyError = errorMap[error.message] || `Login gagal: ${error.message}`
        return { success: false, error: friendlyError }
      }

      // Login berhasil — ambil profil dari tabel user_profiles
      const profile = await get()._fetchProfile(data.session.user.id)
      saveToCache(data.session, profile)
      set({ session: data.session, user: { ...data.session.user, ...profile } })
      
      // Tarik semua data dari cloud ke IndexedDB (Sinkronisasi awal)
      pullFromSupabase()

      // Aktifkan koneksi WebSocket (Realtime)
      subscribeToRealtime()

      return { success: true, error: null }

    } catch (err) {
      // Tangani error jaringan (tidak ada koneksi saat login)
      return { success: false, error: 'Tidak ada koneksi internet. Login memerlukan koneksi.' }
    } finally {
      set({ isLoading: false })
    }
  },



  /**
   * resendVerificationEmail — Mengirim ulang email verifikasi.
   */
  resendVerificationEmail: async (email) => {
    set({ isLoading: true })
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })

      if (error) {
        return { success: false, error: `Gagal mengirim ulang email: ${error.message}` }
      }
      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: 'Terjadi kesalahan jaringan.' }
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * logout — Akhiri sesi, bersihkan state dan cache lokal.
   */
  logout: async () => {
    try {
      unsubscribeRealtime()
      await supabase.auth.signOut()
    } catch (err) {
      // Tetap lanjutkan logout lokal meskipun request ke server gagal
      console.warn('[Auth] Supabase signOut gagal, membersihkan sesi lokal:', err.message)
    } finally {
      clearCache()
      set({ session: null, user: null })
    }
  },

  /**
   * _fetchProfile (private) — Mengambil profil dari tabel user_profiles.
   * Jika gagal (misal network error), mengembalikan objek profil default.
   */
  _fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name, role')
        .eq('id', userId)
        .single()

      if (error || !data) {
        console.warn('[Auth] Gagal mengambil profil user:', error?.message)
        return { full_name: 'Pengguna', role: 'kasir' } // Fallback aman
      }
      return data
    } catch (err) {
      return { full_name: 'Pengguna', role: 'kasir' } // Fallback jika offline
    }
  },

  // ── GETTER/SELECTOR (Helper yang mudah dipanggil dari komponen) ────────────

  /** Cek apakah user sedang login */
  isLoggedIn: () => !!get().user,

  /** Cek apakah user adalah admin */
  isAdmin: () => get().user?.role === 'admin',

  /** Cek apakah user adalah kasir */
  isKasir: () => get().user?.role === 'kasir',

  /** Ambil nama lengkap user, fallback ke 'Pengguna' jika belum ada */
  getFullName: () => get().user?.full_name || 'Pengguna',

  /** Ambil role user */
  getRole: () => get().user?.role || null,
}))

// ── LISTENER OTOMATIS UNTUK PERUBAHAN STATE AUTH ─────────────────────────────
// Supabase memancarkan event ketika token di-refresh atau session berubah.
// Kita tangkap event ini untuk menjaga state Zustand selalu sinkron.
supabase.auth.onAuthStateChange(async (event, session) => {
  const store = useAuthStore.getState()

  if (event === 'TOKEN_REFRESHED' && session) {
    // Token berhasil di-refresh oleh Supabase secara otomatis
    const profile = await store._fetchProfile(session.user.id)
    saveToCache(session, profile)
    useAuthStore.setState({ session, user: { ...session.user, ...profile } })
    console.log('[Auth] Token berhasil di-refresh.')
  }

  if (event === 'SIGNED_OUT') {
    unsubscribeRealtime()
    clearCache()
    useAuthStore.setState({ session: null, user: null })
  }
})

export default useAuthStore
