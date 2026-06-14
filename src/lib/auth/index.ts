// ============================================================
// Auth Utilities — Supabase Auth Only
// All authentication now goes through Supabase Auth.
// Local bcrypt + HMAC session tokens have been removed.
// ============================================================

export const SESSION_COOKIE_NAME = 'fresh_mart_session'
export const SUPABASE_AUTH_COOKIE_NAME = 'sb-access-token'
export const SUPABASE_REFRESH_COOKIE_NAME = 'sb-refresh-token'

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: false, // Supabase needs client-side access for token refresh
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
}

// ─── Auth Strategy ─────────────────────────────────────────

export type AuthStrategy = 'supabase'

/**
 * Always returns 'supabase' — we're fully migrated.
 * Kept for backward compatibility with any code that checks this.
 */
export function getAuthStrategy(): AuthStrategy {
  return 'supabase'
}

/**
 * Check if Supabase Auth is configured and available.
 * Always true after migration, but kept as a safety check.
 */
export function isSupabaseAuthConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && anonKey && url.startsWith('https://'))
}

// ─── User Role Helpers ─────────────────────────────────────

export type UserRole = 'customer' | 'driver' | 'owner' | 'manager'

export function isValidRole(role: string): role is UserRole {
  return ['customer', 'driver', 'owner', 'manager'].includes(role)
}

export function isAdminRole(role: string): boolean {
  return ['owner', 'manager'].includes(role.toLowerCase())
}

export function isDriverRole(role: string): boolean {
  return role.toLowerCase() === 'driver'
}

/**
 * Determine where a user should be redirected based on their role.
 * - owner/manager → /admin
 * - driver → /driver
 * - customer → fallback (usually /)
 *
 * Role comparison is case-insensitive to handle both
 * uppercase (Prisma enum) and lowercase (legacy tokens).
 */
export function getRoleBasedRedirect(role: string, fallback = '/'): string {
  const normalized = role.toUpperCase()
  if (normalized === 'OWNER' || normalized === 'MANAGER') return '/admin'
  if (normalized === 'DRIVER') return '/driver'
  return fallback
}
