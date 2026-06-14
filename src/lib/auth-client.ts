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
  createdAt?: string
}

export interface AuthResponse {
  user: AuthUser | null
  error: string | TechnicalError | null
}

// ─── Auth Methods ─────────────────────────────────────────

/**
 * Register a new account
 */
export async function authRegister(email: string, password: string, fullName: string): Promise<AuthResponse> {
  const endpoint = '/api/auth/register'
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
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
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
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
 * Driver/Picker → /driver
 * Customer → /
 */
export function getRoleBasedRedirect(role: string): string {
  const r = (role || '').toLowerCase().trim()
  if (r === 'owner' || r === 'manager') return '/admin'
  if (r === 'driver' || r === 'picker') return '/driver'
  return '/'
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
