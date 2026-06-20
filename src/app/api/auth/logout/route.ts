import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth'
import { revokeSessionByToken } from '@/lib/session-manager'
import { invalidateSessionCache } from '@/lib/auth/server'

export async function POST(request: NextRequest) {
  // Try to revoke the session row in the DB (so the device is freed up)
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    // Verify token signature before revoking (don't trust raw cookie)
    const payload = verifySessionToken(token)
    if (payload?.sid) {
      // If the token has a sid, revoke by sid (more reliable than token hash)
      try {
        const { revokeSession } = await import('@/lib/session-manager')
        await revokeSession(payload.sid)
      } catch (err) {
        console.warn('[Auth Logout] Failed to revoke session by sid:', err)
        // Fall back to token-hash revocation
        await revokeSessionByToken(token).catch(() => {})
      }
    } else {
      // Legacy token without sid — revoke by token hash
      await revokeSessionByToken(token).catch(() => {})
    }
    // Invalidate the in-memory session cache for this token
    invalidateSessionCache(token)
  }

  const response = NextResponse.json({ success: true })

  // Clear the session cookie
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Expire immediately
  })

  return response
}
