import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// Register Route — Supabase Auth
// Uses Supabase Auth signUp for user registration.
// The handle_new_user trigger auto-creates a profile row.
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
        endpoint: '/api/auth/register',
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

    let body: { email?: string; password?: string; fullName?: string; role?: string }
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

    const { email, password, fullName, role } = body

    // Validate input
    if (!email || !password) {
      return buildApiError(
        'Email and password are required.',
        'MISSING_FIELDS',
        400,
        `Received: email=${email ? 'provided' : 'missing'}, password=${password ? 'provided' : 'missing'}, fullName=${fullName ? 'provided' : 'missing'}`,
      )
    }

    if (password.length < 8) {
      return buildApiError(
        'Password must be at least 8 characters long.',
        'PASSWORD_TOO_SHORT',
        400,
        `Provided password length: ${password.length}. Minimum required: 8.`,
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return buildApiError(
        'Please enter a valid email address.',
        'INVALID_EMAIL',
        400,
        `The provided email "${email}" does not match the required format.`,
      )
    }

    // Validate role (only allow customer or driver for self-registration)
    const requestedRole = role || 'customer'
    if (!['customer', 'driver'].includes(requestedRole)) {
      return buildApiError(
        'Invalid role specified.',
        'INVALID_ROLE',
        400,
        `Role "${requestedRole}" is not allowed for self-registration. Only "customer" and "driver" are permitted.`,
      )
    }

    // ─── Register with Supabase Auth ─────────────────────
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName || '',
          role: requestedRole,
        },
        // Auto-confirm email for development (in production, use email confirmation)
        emailConfirm: true,
      },
    })

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return buildApiError(
          'An account with this email already exists.',
          'AUTH_EMAIL_EXISTS',
          409,
          `A user with email "${email.toLowerCase()}" already exists. Try logging in instead.`,
        )
      }

      if (authError.message.includes('Password') && authError.message.includes('weak')) {
        return buildApiError(
          'Password is too weak. Please use a stronger password.',
          'WEAK_PASSWORD',
          400,
          authError.message,
        )
      }

      return buildApiError(
        'Registration failed. Please try again.',
        'AUTH_ERROR',
        400,
        authError.message,
      )
    }

    if (!authData.user) {
      return buildApiError(
        'Registration failed. Please try again.',
        'AUTH_NO_USER',
        500,
        'Supabase signUp succeeded but no user was returned.',
      )
    }

    // ─── Wait for the profile trigger to complete ────────
    // The handle_new_user trigger should auto-create a profile
    // Give it a moment, then fetch
    await new Promise(resolve => setTimeout(resolve, 500))

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', authData.user.id)
      .single()

    const userRole = profile?.role || requestedRole
    const userName = profile?.full_name || fullName || ''

    // ─── Build response with session cookies ─────────────
    const response = NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: userName,
        role: userRole,
        createdAt: authData.user.created_at,
      },
    }, { status: 201 })

    // Set session cookies if session is available
    // (Supabase may require email confirmation before issuing a session)
    if (authData.session) {
      const cookieOptions = {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      }

      response.cookies.set('sb-access-token', authData.session.access_token, cookieOptions)
      response.cookies.set('sb-refresh-token', authData.session.refresh_token, {
        ...cookieOptions,
        httpOnly: true,
      })
    }

    return response
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    console.error('[Auth] Register error:', error)

    if (errMessage.includes('Supabase not configured')) {
      return buildApiError(
        'Authentication service is not configured. Please contact support.',
        'AUTH_NOT_CONFIGURED',
        503,
        'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.',
      )
    }

    return buildApiError(
      'An internal server error occurred during registration.',
      'INTERNAL_ERROR',
      500,
      errMessage,
    )
  }
}
