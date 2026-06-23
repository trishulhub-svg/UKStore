// ============================================================
// Client-side Auth Helper
// Uses fetch() to call local API routes for authentication.
// Returns TechnicalError objects for debuggable error display.
// Single auth system: local Prisma database + HMAC session tokens.
// ============================================================

import type { TechnicalError } from '@/components/ui/error-alert'
import { parseApiError } from '@/components/ui/error-alert'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: string
  /**
   * Additional roles the user holds beyond their primary `role`
   * (parsed from User.additionalRoles at login time). Used by the
   * combined-roles redirect logic to pick the correct landing page
   * for dual-role users (e.g. primary PICKER + additional MANAGER → /admin).
   * Optional for backwards compat with older API responses.
   */
  additionalRoles?: string[]
  createdAt?: string
}

export interface AuthResponse {
  user: AuthUser | null
  error: string | TechnicalError | null
  /** True when the user must reset their password on first login (new employee accounts) */
  mustResetPassword?: boolean
}

// ─── Auth Methods ─────────────────────────────────────────

/**
 * Register a new account
 */
export async function authRegister(email: string, password: string, fullName: string): Promise<AuthResponse> {
  const endpoint = '/api/auth/register'
  try {
    // Trim email + fullName defensively (mobile keyboards often insert whitespace)
    const cleanEmail = (email || '').trim()
    const cleanFullName = (fullName || '').trim()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, fullName: cleanFullName }),
    })

    if (!res.ok) {
      const technicalError = await parseApiError(res, endpoint)
      return { user: null, error: technicalError }
    }

    const data = await res.json()
    return { user: data.user, error: null }
  } catch (err) {
    const timestamp = new Date().toISOString()
    const errMsg = err instanceof Error ? err.message : String(err)
    const isNetworkError = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('Network request failed')

    return {
      user: null,
      error: {
        message: isNetworkError
          ? 'Unable to connect to the server. The server may be down or there is a network issue.'
          : `Registration request failed: ${errMsg}`,
        code: isNetworkError ? 'NETWORK_ERROR' : 'FETCH_ERROR',
        status: 0,
        details: isNetworkError
          ? `The browser could not reach ${endpoint}. This typically means:\n1. The server is not running\n2. The URL is incorrect\n3. A CORS or network policy is blocking the request\n\nRaw error: ${errMsg}`
          : `Raw error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp,
        endpoint,
      },
    }
  }
}

/**
 * Log in with email and password
 */
export async function authLogin(email: string, password: string): Promise<AuthResponse> {
  const endpoint = '/api/auth/login'
  try {
    // Trim email defensively — mobile keyboards often insert leading/trailing
    // whitespace. The server trims too, but this keeps the request body clean.
    const cleanEmail = (email || '').trim()
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    })

    if (!res.ok) {
      const technicalError = await parseApiError(res, endpoint)
      return { user: null, error: technicalError }
    }

    const data = await res.json()
    return { user: data.user, error: null, mustResetPassword: data.mustResetPassword === true }
  } catch (err) {
    const timestamp = new Date().toISOString()
    const errMsg = err instanceof Error ? err.message : String(err)
    const isNetworkError = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('Network request failed')

    return {
      user: null,
      error: {
        message: isNetworkError
          ? 'Unable to connect to the server. The server may be down or there is a network issue.'
          : `Login request failed: ${errMsg}`,
        code: isNetworkError ? 'NETWORK_ERROR' : 'FETCH_ERROR',
        status: 0,
        details: isNetworkError
          ? `The browser could not reach ${endpoint}. This typically means:\n1. The server is not running\n2. The URL is incorrect\n3. A CORS or network policy is blocking the request\n\nRaw error: ${errMsg}`
          : `Raw error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp,
        endpoint,
      },
    }
  }
}

/**
 * Log out
 */
export async function authLogout(): Promise<{ error: string | TechnicalError | null }> {
  const endpoint = '/api/auth/logout'
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
    })

    if (!res.ok) {
      const technicalError = await parseApiError(res, endpoint)
      return { error: technicalError }
    }

    return { error: null }
  } catch (err) {
    const timestamp = new Date().toISOString()
    const errMsg = err instanceof Error ? err.message : String(err)
    return {
      error: {
        message: 'Unable to connect to the server for logout.',
        code: 'NETWORK_ERROR',
        status: 0,
        details: `Endpoint: ${endpoint}\nRaw error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp,
        endpoint,
      },
    }
  }
}

/**
 * Get the current session user
 */
export async function authGetSession(): Promise<AuthResponse> {
  const endpoint = '/api/auth/session'
  try {
    const res = await fetch(endpoint)

    if (!res.ok) {
      return { user: null, error: null }
    }

    const data = await res.json()
    return { user: data.user, error: null }
  } catch {
    return { user: null, error: null }
  }
}

/**
 * Get the correct redirect path based on user role.
 * Owner/Manager → /admin
 * Driver → /driver
 * Picker → /picker
 * Customer → /
 *
 * NOTE: This function considers ONLY the primary role. For users with
 * dual roles (primary + additionalRoles), use `getRoleBasedRedirectFromRoles`
 * instead — it picks the most privileged destination.
 */
export function getRoleBasedRedirect(role: string): string {
  const r = (role || '').toLowerCase().trim()
  if (r === 'owner' || r === 'manager') return '/admin'
  if (r === 'driver') return '/driver'
  if (r === 'picker') return '/picker'
  return '/'
}

/**
 * Get the correct redirect path based on a user's COMBINED roles
 * (primary + additionalRoles). Picks the most privileged destination:
 *
 *   - OWNER or MANAGER (anywhere) → /admin
 *   - DRIVER (anywhere)            → /driver
 *   - PICKER (anywhere)            → /picker
 *   - otherwise                     → /
 *
 * This fixes the bug where a user with primary role PICKER but
 * additionalRoles including MANAGER would be sent to /picker on login
 * instead of /admin.
 */
export function getRoleBasedRedirectFromRoles(
  primaryRole: string,
  additionalRoles: string[] = [],
): string {
  const allRoles = [
    (primaryRole || '').toLowerCase().trim(),
    ...additionalRoles.map((r) => (r || '').toLowerCase().trim()),
  ].filter(Boolean)

  if (allRoles.some((r) => r === 'owner' || r === 'manager')) return '/admin'
  if (allRoles.some((r) => r === 'driver')) return '/driver'
  if (allRoles.some((r) => r === 'picker')) return '/picker'
  return '/'
}

/**
 * Check if a user (with dual roles) is an admin. Returns true if any of
 * their roles (primary or additional) is OWNER or MANAGER.
 */
export function isAdminWithAdditionalRoles(
  primaryRole: string,
  additionalRoles: string[] = [],
): boolean {
  const check = (r: string) => {
    const lower = (r || '').toLowerCase().trim()
    return lower === 'owner' || lower === 'manager'
  }
  if (check(primaryRole)) return true
  return additionalRoles.some(check)
}

/**
 * Check if a role is an admin role (owner or manager).
 */
export function isAdminRole(role: string): boolean {
  const r = (role || '').toLowerCase().trim()
  return r === 'owner' || r === 'manager'
}

/**
 * Check if a role is a driver/picker role.
 */
export function isDriverRole(role: string): boolean {
  const r = (role || '').toLowerCase().trim()
  return r === 'driver' || r === 'picker'
}
