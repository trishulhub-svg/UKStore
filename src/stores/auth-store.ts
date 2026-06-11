// ============================================================
// Auth Store - Zustand
// Manages user authentication state + profile data
// Hydrated from Supabase Auth session
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, UserRole } from '@/types';

interface AuthState {
  user: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  isStaff: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      signOut: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      hasRole: (role) => {
        const { user } = get();
        if (!user) return false;
        if (Array.isArray(role)) return role.includes(user.role);
        return user.role === role;
      },

      isStaff: () => {
        const { user } = get();
        if (!user) return false;
        return ['owner', 'manager', 'picker', 'rider'].includes(user.role);
      },
    }),
    {
      name: 'uk-grocery-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
