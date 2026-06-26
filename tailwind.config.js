/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'], // Set Outfit as the default sans font
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6', // Biru elektrik utama
          600: '#2563eb', // Biru hover
          700: '#1d4ed8',
        },
        surface: '#ffffff',
        background: '#f8fafc',
      },
    },
  },
  plugins: [],
}

