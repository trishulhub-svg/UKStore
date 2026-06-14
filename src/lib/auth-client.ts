// ============================================================
// Client-side Auth Helper
// Supports both Supabase Auth (primary) and local auth (fallback)
// Uses fetch() to call local API routes
// Returns TechnicalError objects for debuggable error display
// ============================================================

import type { TechnicalError } from '@/components/ui/error-alert'
import { parseApiError } from '@/components/ui/error-alert'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: string
  authProvider?: 'local' | 'supabase'
  createdAt?: string
}

export interface AuthResponse {
  user: AuthUser | null
  error: string | TechnicalError | null
}

// ─── Auth Strategy Detection ──────────────────────────────

/**
 * Check if Supabase Auth is available on the client side.
 * This is a hint — the server makes the final decision.
 */
export function isSupabaseAuthAvailable(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && key && url.startsWith('https://'))
}

// ─── Local Auth Methods ───────────────────────────────────

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

// ─── Supabase Auth Client Methods (when Supabase is connected) ──

/**
 * Initialize Supabase Auth client for browser-side operations.
 * Returns null if Supabase is not configured.
 */
export function getSupabaseAuthClient() {
  if (!isSupabaseAuthAvailable()) return null

  // Dynamically import to avoid bundling when not needed
  // The actual Supabase client is used via the /lib/supabase/client module
  return {
    isAvailable: true,
    // Sign in with Supabase Auth - delegates to API route which handles Supabase
    signInWithPassword: async (email: string, password: string): Promise<AuthResponse> => {
      // Still go through our API route which will try Supabase first
      return authLogin(email, password)
    },
    // Sign up with Supabase Auth
    signUp: async (email: string, password: string, fullName: string): Promise<AuthResponse> => {
      return authRegister(email, password, fullName)
    },
    // Sign out from Supabase
    signOut: async (): Promise<{ error: string | TechnicalError | null }> => {
      return authLogout()
    },
  }
}
