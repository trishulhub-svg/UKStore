// ============================================================
// Cart Store - Zustand
// Manages shopping cart state (add, remove, quantity, substitutes)
// Persisted to localStorage for cross-session cart retention
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, SubstitutePreference } from '@/types';

interface CartState {
  items: CartItem[];
  isOpen: boolean;

  // Computed
  itemCount: () => number;
  subtotal: () => number;
  vatAmount: () => number;
  total: () => number;

  // Actions
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setSubstitutePreference: (productId: string, preference: SubstitutePreference) => void;
  clearCart: () => void;
  toggleCart: () => void;
  setCartOpen: (open: boolean) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      itemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      subtotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        );
      },

      vatAmount: () => {
        return get().items.reduce((sum, item) => {
          const itemVat = item.product.price * item.product.vat_rate * item.quantity;
          return sum + itemVat;
        }, 0);
      },

      total: () => {
        return get().subtotal();
      },

      addItem: (product, quantity = 1) => {
        set((state) => {
          const existingItem = state.items.find(
            (item) => item.product_id === product.id
          );

          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.product_id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                product_id: product.id,
                product,
                quantity,
                substitute_preference: 'closest_match' as SubstitutePreference,
              },
            ],
          };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.product_id !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.product_id === productId ? { ...item, quantity } : item
          ),
        }));
      },

      setSubstitutePreference: (productId, preference) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.product_id === productId
              ? { ...item, substitute_preference: preference }
              : item
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      setCartOpen: (open) => set({ isOpen: open }),
    }),
    {
      name: 'uk-grocery-cart',
    }
  )
);
