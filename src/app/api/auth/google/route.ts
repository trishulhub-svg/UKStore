// ============================================================
// Google OAuth — Redirect to Google Consent Screen
// GET /api/auth/google
// Reads client ID from store settings, redirects to Google
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/lib/settings'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const clientId = await getSetting(
      'google_oauth_client_id',
      'GOOGLE_OAUTH_CLIENT_ID'
    )

    if (!clientId) {
      console.error('[Google OAuth] Client ID not configured')
      return NextResponse.json(
        { error: 'Google OAuth is not configured. Please set the Google OAuth Client ID in store settings.' },
        { status: 500 }
      )
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex')

    // Determine redirect URI
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${origin}/api/auth/google/callback`

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    // Create redirect response with state cookie
    const response = NextResponse.redirect(googleAuthUrl)

    // Store state in a short-lived cookie for verification in callback
    response.cookies.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    })

    // Store redirect target if provided
    const redirectTo = request.nextUrl.searchParams.get('redirect')
    if (redirectTo) {
      response.cookies.set('google_oauth_redirect', redirectTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      })
    }

    return response
  } catch (err) {
    console.error('[Google OAuth] Error initiating OAuth flow:', err)
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth. Please try again.' },
      { status: 500 }
    )
  }
}
