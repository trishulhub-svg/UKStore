// ============================================================
// Edge-compatible auth utilities for middleware
// Uses Web Crypto API instead of Node.js crypto module
// Tries Supabase session first, then falls back to HMAC token
// ============================================================

import { getAuthStrategy, SUPABASE_AUTH_COOKIE_NAME } from '@/lib/auth'

const SESSION_SECRET = process.env.AUTH_SECRET || 'fresh-mart-local-dev-secret-change-in-production'
const TOKEN_VERSION = 1

export interface SessionPayload {
  uid: string
  email: string
  role: string
  name: string
  iat: number
  ver: number
  authProvider?: 'local' | 'supabase'
}

export const SESSION_COOKIE_NAME = 'fresh_mart_session'

/**
 * Try to extract user from Supabase JWT token (edge-compatible)
 */
function parseSupabaseToken(token: string): { uid: string; email: string; role: string; name: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    )

    // Check if token is expired
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null

    return {
      uid: payload.sub,
      email: payload.email || '',
      role: payload.role || payload.app_metadata?.role || 'customer',
      name: payload.user_metadata?.full_name || payload.user_metadata?.name || '',
    }
  } catch {
    return null
  }
}

/**
 * Edge-compatible session token verification using Web Crypto API
 */
export async function verifySessionTokenEdge(token: string): Promise<SessionPayload | null> {
  try {
    const [payloadStr, signature] = token.split('.')
    if (!payloadStr || !signature) return null

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const sigBuffer = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const dataBuffer = encoder.encode(payloadStr)

    const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, dataBuffer)
    if (!valid) return null

    const payload: SessionPayload = JSON.parse(
      atob(payloadStr.replace(/-/g, '+').replace(/_/g, '/'))
    )

    // Check token version
    if (payload.ver !== TOKEN_VERSION) return null

    // Check expiry (7 days)
    const maxAge = 7 * 24 * 60 * 60
    if (Math.floor(Date.now() / 1000) - payload.iat > maxAge) return null

    return payload
  } catch {
    return null
  }
}

/**
 * Get the current user from the request cookies.
 * Tries Supabase auth cookie first, then falls back to local HMAC token.
 * This is the main function used by middleware.
 */
export async function getUserFromCookies(
  cookies: { get: (name: string) => { value: string } | undefined }
): Promise<{ uid: string; email: string; role: string; name: string; authProvider: 'local' | 'supabase' } | null> {
  const strategy = getAuthStrategy()

  // ─── Try Supabase Auth first (when configured) ─────────
  if (strategy === 'supabase') {
    const supabaseToken = cookies.get(SUPABASE_AUTH_COOKIE_NAME)?.value
    if (supabaseToken) {
      const supabaseUser = parseSupabaseToken(supabaseToken)
      if (supabaseUser) {
        return { ...supabaseUser, authProvider: 'supabase' }
      }
    }
  }

  // ─── Fall back to local HMAC session ────────────────────
  const token = cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifySessionTokenEdge(token)
  if (!payload) return null

  return {
    uid: payload.uid,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    authProvider: payload.authProvider || 'local',
  }
}
