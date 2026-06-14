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

// ─── Password Hashing ────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ─── Session Token ───────────────────────────────────────
// Format: base64(JSON({uid, email, role, name, iat, ver})).signature
// The signature is HMAC-SHA256 of the payload with the server secret

export interface SessionPayload {
  uid: string       // user ID
  email: string     // user email
  role: string      // user role
  name: string      // display name
  iat: number       // issued at (epoch seconds)
  ver: number       // token version
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

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
}

// ─── Re-export role utilities (defined in roles.ts for Edge compatibility) ──
// These are safe to import from here in Node.js contexts (API routes, server components).
// For Edge Runtime contexts (middleware), import from @/lib/auth/roles instead.

export { getRoleBasedRedirect, isAdminRole, isDriverRole, isValidRole } from './roles'
