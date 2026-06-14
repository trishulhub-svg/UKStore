import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { hashPassword, createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, isSupabaseAuthConfigured } from '@/lib/auth'

function buildApiError(
  message: string,
  code: string,
  status: number,
  details?: string,
  endpoint?: string,
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
        endpoint: endpoint || '/api/auth/register',
      },
    },
    { status }
  )
}

export async function POST(request: NextRequest) {
  const endpoint = '/api/auth/register'
  try {
    let body: { email?: string; password?: string; fullName?: string }
    try {
      body = await request.json()
    } catch {
      return buildApiError(
        'Request body is not valid JSON.',
        'INVALID_BODY',
        400,
        'The server could not parse the request body as JSON. Make sure the Content-Type header is set to application/json.',
        endpoint,
      )
    }

    const { email, password, fullName } = body

    // Validate input
    if (!email || !password) {
      return buildApiError(
        'Email and password are required.',
        'MISSING_FIELDS',
        400,
        `Received: email=${email ? 'provided' : 'missing'}, password=${password ? 'provided' : 'missing'}, fullName=${fullName ? 'provided' : 'missing'}`,
        endpoint,
      )
    }

    if (password.length < 8) {
      return buildApiError(
        'Password must be at least 8 characters long.',
        'PASSWORD_TOO_SHORT',
        400,
        `Provided password length: ${password.length}. Minimum required: 8.`,
        endpoint,
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return buildApiError(
        'Please enter a valid email address.',
        'INVALID_EMAIL',
        400,
        `The provided email "${email}" does not match the required format.`,
        endpoint,
      )
    }

    // ─── Try Supabase Auth first (when configured) ─────────
    if (isSupabaseAuthConfigured()) {
      try {
        const supabaseResult = await registerWithSupabase(email, password, fullName)
        if (supabaseResult) return supabaseResult
      } catch (supaErr) {
        console.warn('[Auth] Supabase register failed, falling back to local:', supaErr)
      }
    }

    // ─── Fall back to local Prisma auth ────────────────────
    return await registerWithLocalDb(email, password, fullName)
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    const errStack = error instanceof Error ? error.stack || '' : ''
    console.error('[Auth] Register error:', error)

    // Detect specific Prisma/database errors
    let code = 'INTERNAL_ERROR'
    let message = 'An internal server error occurred during registration.'
    let status = 500
    let details = `Error: ${errMessage}\n${errStack}`

    if (errMessage.includes('Unique constraint') || errMessage.includes('P2002')) {
      code = 'AUTH_EMAIL_EXISTS'
      message = 'An account with this email already exists.'
      status = 409
      details = `A user with this email already exists in the database.\n${errMessage}`
    } else if (
      errMessage.includes('P2021') ||
      errMessage.includes('does not exist') ||
      errMessage.includes('no such table') ||
      errMessage.includes('SQLITE_ERROR')
    ) {
      code = 'DATABASE_SCHEMA_ERROR'
      message = 'The database schema is not set up correctly. Please run database migrations.'
      status = 500
      details = `The User table may not exist in the database. Run "npx prisma db push" to create it.\nError: ${errMessage}\n${errStack}`
    } else if (
      errMessage.includes('ECONNREFUSED') ||
      errMessage.includes('Connection refused') ||
      errMessage.includes('P1001') ||
      errMessage.includes("Can't reach database server") ||
      errMessage.includes('Unable to open') ||
      errMessage.includes('P1002')
    ) {
      code = 'DATABASE_UNAVAILABLE'
      message = 'Unable to connect to the database. Please try again later.'
      status = 503
      details = `Database connection error during user creation.\nDATABASE_URL is set: ${!!process.env.DATABASE_URL}\nError: ${errMessage}\n${errStack}`
    }

    return buildApiError(message, code, status, details, endpoint)
  }
}

/**
 * Register using Supabase Auth
 * Returns null if Supabase isn't available
 */
async function registerWithSupabase(
  email: string,
  password: string,
  fullName?: string,
): Promise<NextResponse | null> {
  const { createClient: createSupabaseClient } = await import('@/lib/supabase/server')
  const supabase = await createSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName || '',
        role: 'customer',
      },
    },
  })

  if (error) {
    console.warn('[Auth] Supabase register error:', error.message)
    // If it's a "user already exists" error, return that specifically
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      return buildApiError(
        'An account with this email already exists.',
        'AUTH_EMAIL_EXISTS',
        409,
        `Supabase: ${error.message}`,
        '/api/auth/register',
      )
    }
    return null // Fall back to local auth
  }

  if (!data.user) return null

  // Create a local session token
  const role = 'customer'
  const token = createSessionToken({
    uid: data.user.id,
    email: data.user.email || email.toLowerCase(),
    role,
    name: fullName || '',
  })

  // Try to sync user to local DB (non-blocking)
  try {
    const prisma = await getPrisma()
    await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: { name: fullName || null },
      create: {
        id: data.user.id,
        email: email.toLowerCase(),
        name: fullName || null,
        role: 'CUSTOMER',
        isActive: true,
      },
    })
  } catch (dbErr) {
    console.warn('[Auth] Could not sync Supabase user to local DB (non-fatal):', dbErr)
  }

  const response = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email || email.toLowerCase(),
      name: fullName || '',
      role,
      createdAt: data.user.created_at,
    },
  }, { status: 201 })

  response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

  return response
}

/**
 * Register using local Prisma database
 */
async function registerWithLocalDb(
  email: string,
  password: string,
  fullName?: string,
): Promise<NextResponse> {
  const prisma = await getPrisma()

  // Check database connectivity first
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (dbPingError) {
    const dbErrMessage = dbPingError instanceof Error ? dbPingError.message : String(dbPingError)
    console.error('[Auth] Database connectivity check failed:', dbPingError)
    return buildApiError(
      'Unable to connect to the database. Please try again later.',
      'DATABASE_UNAVAILABLE',
      503,
      `Database connectivity check failed.\nError: ${dbErrMessage}`,
      '/api/auth/register',
    )
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (existingUser) {
    return buildApiError(
      'An account with this email already exists.',
      'AUTH_EMAIL_EXISTS',
      409,
      `A user with email "${email.toLowerCase()}" already exists (user ID: ${existingUser.id}, created: ${existingUser.createdAt.toISOString()}). Try logging in instead, or use a different email address.`,
      '/api/auth/register',
    )
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: fullName || null,
      passwordHash,
      role: 'CUSTOMER',
    },
  })

  // Create session token
  const token = createSessionToken({
    uid: user.id,
    email: user.email,
    role: user.role,
    name: user.name || '',
  })

  // Build response with cookie
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  }, { status: 201 })

  response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

  return response
}
