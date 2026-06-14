// ============================================================
// Auth Store - Zustand
// Manages user authentication state + profile data
// Works with both local auth and Supabase Auth
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

/**
 * Normalize a role value to uppercase for comparison.
 * Handles both old lowercase tokens and new uppercase Prisma enum values.
 */
function normalizeRole(role: string): string {
  return role.toUpperCase()
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
        const userRole = normalizeRole(user.role);
        if (Array.isArray(role)) return role.some(r => normalizeRole(r) === userRole);
        return normalizeRole(role) === userRole;
      },

      isStaff: () => {
        const { user } = get();
        if (!user) return false;
        // 'picker' and 'rider' are legacy roles that are now merged into 'DRIVER'
        return ['OWNER', 'MANAGER', 'DRIVER', 'PICKER', 'RIDER'].includes(normalizeRole(user.role));
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
