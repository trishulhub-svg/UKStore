// ============================================================
// Edge-compatible auth utilities for middleware
// Uses Web Crypto API instead of Node.js crypto module
// Single auth source: HMAC-signed session tokens
// ============================================================

const SESSION_SECRET = process.env.AUTH_SECRET || 'fresh-mart-local-dev-secret-change-in-production'
const TOKEN_VERSION = 1

// Inactivity timeout: 5 minutes. Must match src/lib/auth/index.ts.
// Both the middleware (edge) and API routes (node) treat tokens older
// than this as expired. The client-side idle timer in
// src/lib/use-idle-timeout.ts mirrors this on the browser side.
const SESSION_MAX_AGE_SECONDS = 5 * 60

export interface SessionPayload {
  uid: string
  email: string
  role: string
  name: string
  iat: number
  ver: number
  authProvider?: 'local'
  sid?: string  // session row ID — used by server-side session validation
  /**
   * Additional roles the user holds beyond their primary `role`.
   * Populated from User.additionalRoles at login time. Used by middleware
   * and login clients to compute the correct landing dashboard — e.g. a
   * user whose primary role is PICKER but who also has MANAGER in
   * additionalRoles should land on /admin, not /picker.
   *
   * Optional for backwards compatibility with tokens issued before this
   * field was added (treated as [] when absent).
   */
  additionalRoles?: string[]
}

export const SESSION_COOKIE_NAME = 'fresh_mart_session'

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

    // Check expiry (5 minutes — inactivity timeout)
    if (Math.floor(Date.now() / 1000) - payload.iat > SESSION_MAX_AGE_SECONDS) return null

    return payload
  } catch {
    return null
  }
}

/**
 * Get the current user from the request cookies.
 * Single source of truth: the HMAC session token.
 */
export async function getUserFromCookies(
  cookies: { get: (name: string) => { value: string } | undefined }
): Promise<{ uid: string; email: string; role: string; name: string; authProvider: 'local'; additionalRoles: string[] } | null> {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifySessionTokenEdge(token)
  if (!payload) return null

  return {
    uid: payload.uid,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    authProvider: 'local',
    additionalRoles: payload.additionalRoles ?? [],
  }
}
