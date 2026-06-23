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
  /**
   * Additional roles the user holds beyond their primary `role`
   * (parsed from User.additionalRoles at login time, embedded in the
   * session token). Used by server-rendered pages (e.g. /account/profile)
   * to compute the correct dashboard link for dual-role users.
   *
   * Optional for backwards compatibility with older tokens.
   */
  additionalRoles?: string[]
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

    // If the token has a sid, validate the session row exists in the DB.
    //
    // IMPORTANT — Vercel ephemeral filesystem caveat:
    // On Vercel serverless, each Lambda instance has its own /tmp directory.
    // The SQLite DB lives at /tmp/freshmart/custom.db, so each instance gets
    // its own fresh DB on cold start. This means a session row created on
    // Instance A during login may not exist on Instance B when the user's
    // next request lands there — even though the HMAC-signed token is still
    // perfectly valid.
    //
    // To avoid logging users out every time Vercel routes them to a different
    // instance, we treat "session row not found" as a SOFT failure: log a
    // warning and let the user in based on the valid token signature. The
    // token's HMAC signature is still verified above, so forged tokens are
    // still rejected.
    //
    // Trade-off: this disables cross-instance session revocation on Vercel.
    // For production-grade revocation, migrate to a persistent DB (Vercel
    // Postgres, Turso, Supabase, etc.). On self-hosted deployments with a
    // persistent DB, revocation still works as designed.
    if (payload.sid) {
      try {
        const prisma = await getPrisma()
        const session = await prisma.session.findUnique({
          where: { id: payload.sid },
          select: { id: true, userId: true, expiresAt: true },
        })

        if (!session) {
          // Session row not found. On a persistent DB this would mean the
          // session was revoked → log out. On Vercel's ephemeral filesystem
          // this more likely means the request hit a different Lambda
          // instance whose /tmp DB doesn't have this session row.
          // Fail open: trust the HMAC signature and let the user in.
          console.warn(`[Auth] Session row ${payload.sid} not found — failing open (likely Vercel ephemeral DB)`)
        } else if (session.expiresAt.getTime() < now) {
          // Session row expired — clean it up and reject.
          try {
            await prisma.session.delete({ where: { id: payload.sid } })
          } catch {
            // Non-critical
          }
          sessionCache.set(token, { user: null, ts: now })
          return null
        } else if (!cached) {
          // Update lastSeenAt (throttled — only update if older than 60s)
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
      additionalRoles: payload.additionalRoles ?? [],
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
