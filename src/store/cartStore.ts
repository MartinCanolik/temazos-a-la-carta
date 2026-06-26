import { create } from 'zustand'
import type { Track } from '@/types/spotify'

interface CartState {
  items: Track[]
  addItem: (track: Track) => void
  removeItem: (trackId: string) => void
  clearCart: () => void
  hasItem: (trackId: string) => boolean
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (track) => {
    if (get().hasItem(track.id)) return
    set((state) => ({ items: [...state.items, track] }))
  },

  removeItem: (trackId) => {
    set((state) => ({
      items: state.items.filter((t) => t.id !== trackId),
    }))
  },

  clearCart: () => set({ items: [] }),

  hasItem: (trackId) => get().items.some((t) => t.id === trackId),
}))
