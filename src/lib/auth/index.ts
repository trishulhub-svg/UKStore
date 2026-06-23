// ============================================================
// Auth Utilities
// Password hashing, session token creation & verification
// Uses bcryptjs for passwords and HMAC-signed tokens for sessions
// Single auth system: local Prisma database + HMAC session tokens
//
// NOTE: This file uses Node.js 'crypto' module — NOT Edge-compatible.
// For Edge Runtime (middleware), use @/lib/auth/edge and @/lib/auth/roles
// ============================================================

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SALT_ROUNDS = 12
const SESSION_SECRET = process.env.AUTH_SECRET || 'fresh-mart-local-dev-secret-change-in-production'
const TOKEN_VERSION = 1

// ─── Session Lifetime ─────────────────────────────────────
// Inactivity timeout: 5 minutes. After 5 minutes of no activity the session
// is considered expired both on the server (token `iat` is checked) and on
// the client (idle timer redirects to /auth/login).
// NOTE: this is an *absolute* expiry from token issuance, NOT a sliding
// window. For a true sliding window, the client also pings a refresh
// endpoint on activity — see src/lib/use-idle-timeout.ts for the companion
// client-side idle timer.
export const SESSION_MAX_AGE_SECONDS = 5 * 60 // 5 minutes

// ─── Password Hashing ────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ─── Session Token ───────────────────────────────────────
// Format: base64(JSON({uid, email, role, name, iat, ver, sid?})).signature
// The signature is HMAC-SHA256 of the payload with the server secret.
//
// `sid` is the session row ID from the Session table. It is included
// in the token so that getServerUser() can look up the session row
// and verify it still exists (supports device-limit revocation).

export interface SessionPayload {
  uid: string       // user ID
  email: string     // user email
  role: string      // user primary role
  name: string      // display name
  iat: number       // issued at (epoch seconds)
  ver: number       // token version
  sid?: string      // session row ID (for revocation checks). Optional for backwards compat.
  /**
   * Additional roles the user holds beyond their primary `role`
   * (parsed from User.additionalRoles at login time). Used by middleware
   * and login clients to compute the correct landing dashboard when the
   * user has multiple roles (e.g. primary PICKER + additional MANAGER
   * should land on /admin, not /picker).
   *
   * Optional for backwards compatibility with tokens issued before this
   * field was added.
   */
  additionalRoles?: string[]
}

export function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'ver'>): string {
  const data: SessionPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    ver: TOKEN_VERSION,
  }

  const payloadStr = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url')

  return `${payloadStr}.${signature}`
}

/**
 * Hash a session token (payload.signature) for storage in the Session table.
 * We store a hash rather than the raw token so that even DB read access
 * cannot be used to forge a valid cookie.
 */
export function hashSessionToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [payloadStr, signature] = token.split('.')
    if (!payloadStr || !signature) return null

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadStr)
      .digest('base64url')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf-8')
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

// ─── Cookie Helpers ────────────────────────────────────────

export const SESSION_COOKIE_NAME = 'fresh_mart_session'

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS, // 5 minutes (inactivity timeout)
}

// ─── Re-export role utilities (defined in roles.ts for Edge compatibility) ──
// These are safe to import from here in Node.js contexts (API routes, server components).
// For Edge Runtime contexts (middleware), import from @/lib/auth/roles instead.

export {
  getRoleBasedRedirect,
  getRoleBasedRedirectFromRoles,
  isAdminRole,
  isAdminWithAdditionalRoles,
  isDriverRole,
  isValidRole,
  parseAdditionalRoles,
} from './roles'
