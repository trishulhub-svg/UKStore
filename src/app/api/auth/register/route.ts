import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { hashPassword, createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth'

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
        endpoint,
      )
    }

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
        endpoint,
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
      details = `Prisma unique constraint violation. A user with this email already exists in the database.\n${errMessage}`
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
