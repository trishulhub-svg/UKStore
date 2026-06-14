// ============================================================
// Auth Utilities
// Supports both Supabase Auth (primary) and local auth (fallback)
// Password hashing, session token creation & verification
// Uses bcryptjs for passwords and HMAC-signed tokens for local sessions
// ============================================================

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const SALT_ROUNDS = 12
const SESSION_SECRET = process.env.AUTH_SECRET || 'fresh-mart-local-dev-secret-change-in-production'
const TOKEN_VERSION = 1

// ─── Supabase Auth Detection ───────────────────────────────

let supabaseAuthAvailable: boolean | null = null

/**
 * Check if Supabase Auth is configured and available.
 * Result is cached for 60 seconds to avoid repeated checks.
 */
let lastAuthCheck = 0
const AUTH_CHECK_INTERVAL = 60_000

export function isSupabaseAuthConfigured(): boolean {
  const now = Date.now()
  if (supabaseAuthAvailable !== null && now - lastAuthCheck < AUTH_CHECK_INTERVAL) {
    return supabaseAuthAvailable
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  supabaseAuthAvailable = !!(url && anonKey && url.startsWith('https://'))
  lastAuthCheck = now

  return supabaseAuthAvailable
}

// ─── Password Hashing (local auth) ────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ─── Session Token (local auth) ───────────────────────────
// Format: base64(JSON({uid, email, role, name, iat, ver})).signature
// The signature is HMAC-SHA256 of the payload with the server secret

export interface SessionPayload {
  uid: string       // user ID
  email: string     // user email
  role: string      // user role
  name: string      // display name
  iat: number       // issued at (epoch seconds)
  ver: number       // token version
  authProvider?: 'local' | 'supabase'  // which auth system issued this
}

export function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'ver' | 'authProvider'> & { authProvider?: 'local' | 'supabase' }): string {
  const data: SessionPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    ver: TOKEN_VERSION,
    authProvider: payload.authProvider || 'local',
  }

  const payloadStr = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url')

  return `${payloadStr}.${signature}`
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

    // Check expiry (7 days)
    const maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
    if (Math.floor(Date.now() / 1000) - payload.iat > maxAge) return null

    return payload
  } catch {
    return null
  }
}

// ─── Cookie Helpers ────────────────────────────────────────

export const SESSION_COOKIE_NAME = 'fresh_mart_session'
export const SUPABASE_AUTH_COOKIE_NAME = 'sb-access-token'

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
}

// ─── Auth Strategy ─────────────────────────────────────────

export type AuthStrategy = 'supabase' | 'local'

/**
 * Determine which auth strategy to use.
 * When Supabase is configured, use Supabase Auth as primary.
 * Otherwise, fall back to local auth.
 */
export function getAuthStrategy(): AuthStrategy {
  return isSupabaseAuthConfigured() ? 'supabase' : 'local'
}
