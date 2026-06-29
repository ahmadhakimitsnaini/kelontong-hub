/**
 * supabase.js — Inisialisasi Supabase Client
 *
 * Konfigurasi khusus untuk aplikasi PWA Offline-First:
 * - persistSession: true → Token disimpan di localStorage agar sesi bertahan saat refresh
 * - autoRefreshToken: true → Token otomatis di-refresh di background saat online
 * - detectSessionInUrl: false → Matikan OAuth redirect (kita pakai email/password saja)
 * - storageKey: nama unik agar tidak bentrok dengan aplikasi lain di domain yang sama
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL dan Anon Key harus didefinisikan di file .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,          // Simpan session ke localStorage
    autoRefreshToken: true,        // Auto refresh token di background
    detectSessionInUrl: false,     // Tidak perlu OAuth callback URL
    storageKey: 'toko_podjok_auth', // Key unik untuk localStorage
  }
})
