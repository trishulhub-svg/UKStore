import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, CartItem } from '@/types'

interface CartState {
  items: CartItem[]
  addItem: (product: Product, quantity?: number, substitutePreference?: 'closest_match' | 'do_not_substitute') => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateSubstitutePreference: (productId: string, preference: 'closest_match' | 'do_not_substitute') => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, substitutePreference = 'closest_match') => {
        set((state) => {
          const existingItem = state.items.find((item) => item.product.id === product.id)
          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            }
          }
          return {
            items: [...state.items, { product_id: product.id, product, quantity, substitute_preference: substitutePreference }],
          }
        })
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.product.id !== productId),
        }))
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          ),
        }))
      },

      updateSubstitutePreference: (productId, preference) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.product.id === productId ? { ...item, substitute_preference: preference } : item
          ),
        }))
      },

      clearCart: () => {
        set({ items: [] })
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + item.product.price * item.quantity, 0)
      },
    }),
    {
      name: 'uk-grocery-cart',
    }
  )
)
