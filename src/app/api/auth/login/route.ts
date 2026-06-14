import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, isSupabaseAuthConfigured } from '@/lib/auth'

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
        endpoint: endpoint || '/api/auth/login',
      },
    },
    { status }
  )
}

export async function POST(request: NextRequest) {
  const endpoint = '/api/auth/login'
  try {
    // ─── Try Supabase Auth first (when configured) ─────────
    if (isSupabaseAuthConfigured()) {
      try {
        const supabaseResult = await loginWithSupabase(request)
        if (supabaseResult) return supabaseResult
      } catch (supaErr) {
        console.warn('[Auth] Supabase auth failed, falling back to local auth:', supaErr)
      }
    }

    // ─── Fall back to local Prisma auth ────────────────────
    return await loginWithLocalDb(request)
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    const errStack = error instanceof Error ? error.stack || '' : ''
    console.error('[Auth] Login error:', error)

    // Detect specific Prisma/database errors
    let code = 'INTERNAL_ERROR'
    let message = 'An internal server error occurred during login.'
    let status = 500
    let details = `Error: ${errMessage}\n${errStack}`

    if (
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
      details = `Database connection error.\nDATABASE_URL is set: ${!!process.env.DATABASE_URL}\nError: ${errMessage}\n${errStack}`
    }

    return buildApiError(message, code, status, details, endpoint)
  }
}

/**
 * Login using Supabase Auth
 * Returns null if Supabase isn't available or credentials don't work there
 */
async function loginWithSupabase(request: NextRequest): Promise<NextResponse | null> {
  const { createClient: createSupabaseClient } = await import('@/lib/supabase/server')
  const supabase = await createSupabaseClient()
  if (!supabase) return null

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return null
  }

  const { email, password } = body
  if (!email || !password) return null

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  })

  if (error || !data.user) {
    console.warn('[Auth] Supabase login failed:', error?.message)
    return null // Fall back to local auth
  }

  // Get user role from Supabase metadata
  const role = (data.user.app_metadata?.role ||
    data.user.user_metadata?.role ||
    'customer').toLowerCase()

  // Create a local session token as well for middleware compatibility
  const token = createSessionToken({
    uid: data.user.id,
    email: data.user.email || '',
    role,
    name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
  })

  // Try to sync user to local DB (non-blocking)
  try {
    const prisma = await getPrisma()
    await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
        role: role.toUpperCase() === 'OWNER' || role.toUpperCase() === 'MANAGER' ? 'OWNER' :
              role.toUpperCase() === 'DRIVER' || role.toUpperCase() === 'PICKER' ? 'DRIVER' : 'CUSTOMER',
      },
      create: {
        id: data.user.id,
        email: email.toLowerCase(),
        name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
        role: role.toUpperCase() === 'OWNER' || role.toUpperCase() === 'MANAGER' ? 'OWNER' :
              role.toUpperCase() === 'DRIVER' || role.toUpperCase() === 'PICKER' ? 'DRIVER' : 'CUSTOMER',
        isActive: true,
      },
    })
  } catch (dbErr) {
    console.warn('[Auth] Could not sync Supabase user to local DB (non-fatal):', dbErr)
  }

  const response = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || '',
      role,
      createdAt: data.user.created_at,
    },
  })

  response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

  return response
}

/**
 * Login using local Prisma database
 */
async function loginWithLocalDb(request: NextRequest): Promise<NextResponse> {
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
      `Database connectivity check failed.\nError: ${dbErrMessage}\n\nDATABASE_URL is set: ${!!process.env.DATABASE_URL}\nDATABASE_URL value: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/[^/]*$/, '/***') : 'NOT SET'}\n\nThis usually means:\n1. The DATABASE_URL environment variable is not configured\n2. The SQLite database file does not exist at the specified path\n3. The Prisma client was not generated (run: npx prisma generate)`,
      '/api/auth/login',
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return buildApiError(
      'Request body is not valid JSON.',
      'INVALID_BODY',
      400,
      'The server could not parse the request body as JSON. Make sure the Content-Type header is set to application/json.',
      '/api/auth/login',
    )
  }

  const { email, password } = body

  // Validate input
  if (!email || !password) {
    return buildApiError(
      'Email and password are required.',
      'MISSING_FIELDS',
      400,
      `Received: email=${email ? 'provided' : 'missing'}, password=${password ? 'provided' : 'missing'}`,
      '/api/auth/login',
    )
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (!user || !user.passwordHash) {
    return buildApiError(
      'Invalid email or password.',
      'AUTH_INVALID_CREDENTIALS',
      401,
      `No user found with email "${email.toLowerCase()}" or the user has no password set. If you registered via OAuth, try signing in with that provider instead.`,
      '/api/auth/login',
    )
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    return buildApiError(
      'Invalid email or password.',
      'AUTH_INVALID_CREDENTIALS',
      401,
      `Password verification failed for user "${email.toLowerCase()}". Check that you are using the correct password.`,
      '/api/auth/login',
    )
  }

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
  })

  response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

  return response
}
