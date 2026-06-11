// ============================================================
// UI Store - Zustand
// Manages global UI state (sidebar, search, notifications)
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  isSidebarOpen: boolean;
  isSearchOpen: boolean;
  isMobileMenuOpen: boolean;
  activeTab: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      isSearchOpen: false,
      isMobileMenuOpen: false,
      activeTab: 'home',

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),

      toggleSearch: () =>
        set((state) => ({ isSearchOpen: !state.isSearchOpen })),
      setSearchOpen: (open) => set({ isSearchOpen: open }),

      toggleMobileMenu: () =>
        set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
      setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'uk-grocery-ui',
      partialize: (state) => ({
        activeTab: state.activeTab,
      }),
    }
  )
);
