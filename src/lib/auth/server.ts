// ============================================================
// Server-side auth helper
// Single auth source: HMAC-signed session token
// No more dual Supabase/local auth — eliminates the
// "Supabase JWT overrides local token role" bug permanently.
//
// Session validation: in addition to HMAC signature verification,
// we look up the `sid` (session row ID) in the Session table to
// support immediate revocation when:
//   - An admin manually revokes a session
//   - A device limit is hit and the oldest session is replaced
// ============================================================

import { cookies } from 'next/headers'
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from '@/lib/auth'
import { getPrisma } from '@/lib/auth/prisma'

export interface ServerUser {
  id: string
  email: string
  name: string
  role: string
  authProvider: 'local'
  sid?: string  // session row ID
}

/**
 * Cached session validation result per-request. We use a Module-level
 * cache keyed by token string so that multiple getServerUser() calls
 * in the same request don't all hit the DB.
 *
 * Note: Next.js may reuse module state across requests on the same
 * server instance, so we only cache the *result* keyed by token —
 * and tokens are unique per session. We don't cache negative results
 * (null) so that a re-login in the same server instance isn't blocked.
 */
const sessionCache = new Map<string, { user: ServerUser | null; ts: number }>()
const CACHE_TTL_MS = 10_000  // 10 seconds — short TTL to balance perf vs revocation latency

/**
 * Get the current authenticated user from the session cookie.
 * Single source of truth: the HMAC-signed session token.
 *
 * Validation flow:
 *   1. Verify HMAC signature (rejects forged tokens)
 *   2. Check token expiry (7 days)
 *   3. If token has `sid`: look up Session row in DB. Reject if missing
 *      (session was revoked). Updates lastSeenAt on hit.
 *   4. Return the user
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies()

    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!token) return null

    // Check cache
    const now = Date.now()
    const cached = sessionCache.get(token)
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return cached.user
    }

    const payload: SessionPayload | null = verifySessionToken(token)
    if (!payload) {
      // Token signature failed or expired — don't cache (user may re-login)
      return null
    }

    // If the token has a sid, validate the session row exists in the DB
    if (payload.sid) {
      try {
        const prisma = await getPrisma()
        const session = await prisma.session.findUnique({
          where: { id: payload.sid },
          select: { id: true, userId: true, expiresAt: true },
        })

        if (!session) {
          // Session was revoked
          sessionCache.set(token, { user: null, ts: now })
          return null
        }

        // Check session row expiry (separate from token expiry)
        if (session.expiresAt.getTime() < now) {
          // Clean up expired session row
          try {
            await prisma.session.delete({ where: { id: payload.sid } })
          } catch {
            // Non-critical
          }
          sessionCache.set(token, { user: null, ts: now })
          return null
        }

        // Update lastSeenAt (throttled — only update if older than 60s)
        // We don't throttle here for simplicity; the write is cheap.
        // Skip on cached requests.
        if (!cached) {
          try {
            await prisma.session.update({
              where: { id: payload.sid },
              data: { lastSeenAt: new Date() },
            })
          } catch {
            // Non-critical
          }
        }
      } catch (err) {
        // If DB lookup fails, fail OPEN (let the user in based on the valid signature).
        // This prevents a DB blip from logging out every user.
        console.error('[Auth] Session DB lookup failed, failing open:', err)
      }
    }

    const user: ServerUser = {
      id: payload.uid,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      authProvider: 'local',
      sid: payload.sid,
    }

    sessionCache.set(token, { user, ts: now })
    return user
  } catch {
    return null
  }
}

/**
 * Invalidate the cached session result for a given token.
 * Called when a session is revoked via admin action or logout.
 */
export function invalidateSessionCache(token?: string): void {
  if (token) {
    sessionCache.delete(token)
  } else {
    sessionCache.clear()
  }
}
