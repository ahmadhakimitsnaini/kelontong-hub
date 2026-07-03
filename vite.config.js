import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'MaduraDigital Dashboard',
        short_name: 'MaduraDigital',
        description: 'Sistem manajemen operasional Warung Madura',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    // Naikkan batas peringatan ke 1MB agar build tidak terganggu warning
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // Pecah library besar menjadi chunk terpisah (Code Splitting)
        // Agar browser bisa mengunduh paralel & cache lebih efisien
        // Menggunakan sintaks Function agar kompatibel dengan Vite 8 (Rolldown)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('dexie')) return 'vendor-dexie';
            if (id.includes('zustand')) return 'vendor-zustand';
            if (id.includes('lucide')) return 'vendor-lucide';
            return 'vendor'; // Sisa library lainnya
          }
        }
      }
    }
  }
})

