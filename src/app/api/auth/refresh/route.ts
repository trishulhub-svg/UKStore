import { NextRequest, NextResponse } from 'next/server'
import {
  verifySessionToken,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth'

// ============================================================
// POST /api/auth/refresh
//
// Issues a fresh session token (new `iat`) for the currently-authenticated
// user. This implements the "sliding window" inactivity timeout:
//
//   - Token expires 5 minutes after issuance (auth/index.ts).
//   - Client-side idle timer pings /api/auth/refresh on user activity
//     (throttled to once per minute — see src/lib/use-idle-timeout.tsx).
//   - As long as the user is active, their token gets a fresh 5-minute
//     lease on every refresh.
//   - If they go idle for 5 minutes, no refresh happens, the token
//     expires, and the next API call returns 401 → apiFetch redirects
//     to /auth/login.
//
// Returns 200 + {user} on success, 401 if the current token is already
// expired/invalid.
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 })
    }

    const payload = verifySessionToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Session expired or invalid' }, { status: 401 })
    }

    // Issue a fresh token with the same payload but a new `iat`.
    const freshToken = createSessionToken({
      uid: payload.uid,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: payload.uid,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
    })

    response.cookies.set(SESSION_COOKIE_NAME, freshToken, SESSION_COOKIE_OPTIONS)
    return response
  } catch {
    return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 })
  }
}
