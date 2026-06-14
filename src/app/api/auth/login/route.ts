import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// Login Route — Supabase Auth
// Uses Supabase Auth signInWithPassword for authentication.
// Returns session tokens as cookies.
// ============================================================

function buildApiError(
  message: string,
  code: string,
  status: number,
  details?: string,
) {
  return NextResponse.json(
    {
      error: message,
      code,
      technicalError: {
        message,
        code,
        status,
        details: details || '',
        timestamp: new Date().toISOString(),
        endpoint: '/api/auth/login',
      },
    },
    { status }
  )
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase not configured')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()

    let body: { email?: string; password?: string }
    try {
      body = await request.json()
    } catch {
      return buildApiError(
        'Request body is not valid JSON.',
        'INVALID_BODY',
        400,
        'The server could not parse the request body as JSON.',
      )
    }

    const { email, password } = body

    if (!email || !password) {
      return buildApiError(
        'Email and password are required.',
        'MISSING_FIELDS',
        400,
        `Received: email=${email ? 'provided' : 'missing'}, password=${password ? 'provided' : 'missing'}`,
      )
    }

    // ─── Authenticate with Supabase Auth ─────────────────
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    })

    if (authError) {
      // Map Supabase auth errors to user-friendly messages
      if (authError.message.includes('Invalid login credentials') || authError.message.includes('Email not confirmed')) {
        return buildApiError(
          'Invalid email or password.',
          'AUTH_INVALID_CREDENTIALS',
          401,
          authError.message,
        )
      }

      return buildApiError(
        'Login failed. Please try again.',
        'AUTH_ERROR',
        401,
        authError.message,
      )
    }

    if (!authData.user || !authData.session) {
      return buildApiError(
        'Login failed. Please try again.',
        'AUTH_NO_SESSION',
        401,
        'Supabase auth succeeded but no session was returned.',
      )
    }

    // ─── Fetch user profile for role info ─────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name, is_active')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      console.warn('[Auth] Profile not found for user:', authData.user.id, profileError?.message)
      // Continue without profile — user exists in auth but profile may not be created yet
    }

    // Check if user is active
    if (profile && !profile.is_active) {
      return buildApiError(
        'Your account has been deactivated. Please contact support.',
        'ACCOUNT_DEACTIVATED',
          403,
        'User is_active is false.',
      )
    }

    const userRole = profile?.role || 'customer'
    const userName = profile?.full_name || authData.user.user_metadata?.full_name || ''

    // ─── Build response with session cookies ─────────────
    const response = NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: userName,
        role: userRole,
        createdAt: authData.user.created_at,
      },
    })

    // Set Supabase auth cookies
    // The access token is stored in a cookie for middleware to read
    const cookieOptions = {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    }

    response.cookies.set('sb-access-token', authData.session.access_token, cookieOptions)
    response.cookies.set('sb-refresh-token', authData.session.refresh_token, {
      ...cookieOptions,
      httpOnly: true,
    })

    return response
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    console.error('[Auth] Login error:', error)

    if (errMessage.includes('Supabase not configured')) {
      return buildApiError(
        'Authentication service is not configured. Please contact support.',
        'AUTH_NOT_CONFIGURED',
        503,
        'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.',
      )
    }

    return buildApiError(
      'An internal server error occurred during login.',
      'INTERNAL_ERROR',
      500,
      errMessage,
    )
  }
}
