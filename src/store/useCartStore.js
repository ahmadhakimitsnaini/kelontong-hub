import { create } from 'zustand'

/**
 * MaduraDigital - Cart State Management (Zustand)
 *
 * Store ini mengelola semua logika keranjang belanja di halaman Kasir (POS).
 * Berjalan sepenuhnya di memory (cepat), tidak perlu database untuk ini.
 *
 * Struktur item di keranjang:
 * {
 *   id          : number   - ID produk dari tabel products
 *   nama        : string   - Nama produk
 *   harga_jual  : number   - Harga jual satuan
 *   harga_beli  : number   - Harga beli/modal satuan (untuk kalkulasi laba)
 *   quantity    : number   - Jumlah yang dibeli
 *   subtotal    : number   - harga_jual * quantity
 * }
 */
export const useCartStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────

  /** Daftar item di keranjang */
  items: [],

  // ── Computed (Getters) ─────────────────────────────────────────────────────

  /** Total jumlah item (quantity) di keranjang */
  getTotalItems: () => {
    return get().items.reduce((acc, item) => acc + item.quantity, 0)
  },

  /** Total harga akhir */
  getTotal: () => {
    return get().items.reduce((acc, item) => acc + item.subtotal, 0)
  },

  /** Estimasi laba kotor dari transaksi ini */
  getEstimasiLaba: () => {
    return get().items.reduce((acc, item) => {
      const labaPerItem = (item.harga_jual - item.harga_beli) * item.quantity
      return acc + labaPerItem
    }, 0)
  },

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Menambahkan produk ke keranjang.
   * Jika produk sudah ada, quantity-nya akan bertambah.
   * @param {object} product - Objek produk dari tabel products
   */
  addItem: (product) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.id === product.id)

      if (existingItem) {
        // Produk sudah ada → tambah quantity
        return {
          items: state.items.map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  subtotal: item.harga_jual * (item.quantity + 1),
                }
              : item
          ),
        }
      }

      // Produk baru → tambahkan ke keranjang
      return {
        items: [
          ...state.items,
          {
            id: product.id,
            nama: product.nama,
            harga_jual: product.harga_jual,
            harga_beli: product.harga_beli,
            quantity: 1,
            subtotal: product.harga_jual,
          },
        ],
      }
    })
  },

  /**
   * Mengurangi quantity produk di keranjang.
   * Jika quantity menjadi 0, item akan dihapus otomatis.
   * @param {number} productId - ID produk yang akan dikurangi
   */
  removeOneItem: (productId) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.id === productId)
      if (!existingItem) return state

      if (existingItem.quantity === 1) {
        // Hapus item jika quantity sudah 1
        return { items: state.items.filter((item) => item.id !== productId) }
      }

      return {
        items: state.items.map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
                subtotal: item.harga_jual * (item.quantity - 1),
              }
            : item
        ),
      }
    })
  },

  /**
   * Menghapus item tertentu dari keranjang sepenuhnya.
   * @param {number} productId - ID produk yang akan dihapus
   */
  deleteItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== productId),
    }))
  },

  /**
   * Mengosongkan seluruh keranjang.
   * Dipanggil setelah transaksi berhasil dibayar.
   */
  clearCart: () => {
    set({ items: [] })
  },
}))

export default useCartStore
