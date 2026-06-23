// ============================================================
// Google OAuth — Callback Handler
// GET /api/auth/google/callback
// Exchanges code for tokens, gets user profile,
// finds or creates user in database, sets session cookie
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'
import { getPrisma } from '@/lib/auth/prisma'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import { getRoleBasedRedirectFromRoles, parseAdditionalRoles } from '@/lib/auth/roles'

interface GoogleTokenResponse {
  access_token: string
  id_token?: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  given_name?: string
  family_name?: string
  picture?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denial or OAuth error
    if (error) {
      console.warn('[Google OAuth] User denied access or error:', error)
      return NextResponse.redirect(new URL('/auth/login?error=oauth_denied', request.url))
    }

    if (!code || !state) {
      console.error('[Google OAuth] Missing code or state parameter')
      return NextResponse.redirect(new URL('/auth/login?error=oauth_invalid', request.url))
    }

    // Verify state matches (CSRF protection)
    const storedState = request.cookies.get('google_oauth_state')?.value
    if (!storedState || storedState !== state) {
      console.error('[Google OAuth] State mismatch — possible CSRF attack')
      return NextResponse.redirect(new URL('/auth/login?error=oauth_invalid', request.url))
    }

    // Get OAuth config from settings
    const clientId = await getSetting('google_oauth_client_id', 'GOOGLE_OAUTH_CLIENT_ID')
    const clientSecret = await getSetting('google_oauth_client_secret', 'GOOGLE_OAUTH_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      console.error('[Google OAuth] Client ID or Secret not configured')
      return NextResponse.redirect(new URL('/auth/login?error=oauth_not_configured', request.url))
    }

    // Determine redirect URI (must match the one used in the authorization request)
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${origin}/api/auth/google/callback`

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      console.error('[Google OAuth] Token exchange failed:', tokenResponse.status, errorBody)
      return NextResponse.redirect(new URL('/auth/login?error=oauth_token_failed', request.url))
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()

    // Get user profile from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userResponse.ok) {
      console.error('[Google OAuth] Failed to fetch user info:', userResponse.status)
      return NextResponse.redirect(new URL('/auth/login?error=oauth_userinfo_failed', request.url))
    }

    const googleUser: GoogleUserInfo = await userResponse.json()

    if (!googleUser.email) {
      console.error('[Google OAuth] No email in Google profile')
      return NextResponse.redirect(new URL('/auth/login?error=oauth_no_email', request.url))
    }

    // Find or create user in the database
    const prisma = await getPrisma()
    const email = googleUser.email.toLowerCase()

    let user = await prisma.user.findUnique({
      where: { email },
    })

    if (user) {
      // Update existing user with Google info if not set
      const updateData: Record<string, any> = {}
      if (!user.name && googleUser.name) updateData.name = googleUser.name
      if (!user.avatarUrl && googleUser.picture) updateData.avatarUrl = googleUser.picture

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        })
      }
    } else {
      // Create new user from Google profile
      user = await prisma.user.create({
        data: {
          email,
          name: googleUser.name || null,
          avatarUrl: googleUser.picture || null,
          role: 'CUSTOMER',
          // No passwordHash — user authenticates via Google
        },
      })
    }

    // Create session token with the user's role + additionalRoles from the database.
    // additionalRoles is what enables dual-role staff (e.g. a PICKER who is also
    // a MANAGER) — without it, the redirect below would send them to the wrong
    // dashboard.
    const additionalRoles = parseAdditionalRoles(user.additionalRoles)
    const token = createSessionToken({
      uid: user.id,
      email: user.email,
      role: user.role,
      name: user.name || '',
      additionalRoles,
    })

    // Determine redirect destination based on the user's combined roles
    // (primary + additional). This fixes the bug where a user with primary
    // role PICKER but additionalRoles including MANAGER would be sent to
    // /picker instead of /admin. Also fixes the older bug where PICKER
    // users were sent to /driver.
    const redirectTo = getRoleBasedRedirectFromRoles(user.role, additionalRoles)

    // Build redirect response
    const response = NextResponse.redirect(new URL(redirectTo, request.url))

    // Set session cookie
    response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

    // Clear OAuth state cookies
    response.cookies.set('google_oauth_state', '', { path: '/', maxAge: 0 })
    response.cookies.set('google_oauth_redirect', '', { path: '/', maxAge: 0 })

    return response
  } catch (err) {
    console.error('[Google OAuth] Callback error:', err)
    return NextResponse.redirect(new URL('/auth/login?error=oauth_internal', request.url))
  }
}
