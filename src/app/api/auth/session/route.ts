import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const payload = verifySessionToken(token)

    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: payload.uid,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        // Include additionalRoles so client-side code (e.g. home-client
        // redirect on `/`) can compute the correct dashboard for dual-role
        // users. Defaults to [] for older tokens that predate this field.
        additionalRoles: payload.additionalRoles ?? [],
      },
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
