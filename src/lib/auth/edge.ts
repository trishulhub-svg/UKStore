// ============================================================
// Edge-compatible auth utilities for middleware
// Uses Web Crypto API instead of Node.js crypto module
// ============================================================

const SESSION_SECRET = process.env.AUTH_SECRET || 'fresh-mart-local-dev-secret-change-in-production'
const TOKEN_VERSION = 1

export interface SessionPayload {
  uid: string
  email: string
  role: string
  name: string
  iat: number
  ver: number
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

    // Check expiry (7 days)
    const maxAge = 7 * 24 * 60 * 60
    if (Math.floor(Date.now() / 1000) - payload.iat > maxAge) return null

    return payload
  } catch {
    return null
  }
}
