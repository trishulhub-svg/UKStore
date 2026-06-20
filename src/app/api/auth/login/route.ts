import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import {
  parseUserAgent,
  getClientIp,
  enforceDeviceLimit,
  createSession,
} from '@/lib/session-manager'

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
        `Database connectivity check failed.\nError: ${dbErrMessage}\n\nDATABASE_URL is set: ${!!process.env.DATABASE_URL}\nDATABASE_URL value: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/[^/]*$/, '/***') : 'NOT SET'}`,
        endpoint,
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
        endpoint,
      )
    }

    const { email: rawEmail, password: rawPassword } = body

    // Normalize email: trim whitespace + lowercase. Mobile keyboards often
    // auto-insert a leading/trailing space (especially after autocorrect),
    // and without trimming, "kiranpradhan2057@gmail.com " (note the trailing
    // space) would fail the DB lookup even though the user exists. This was
    // the root cause of Task 9's "wrong password" bug report — the email
    // was correct but had surrounding whitespace.
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    const password = typeof rawPassword === 'string' ? rawPassword : ''

    // Validate input
    if (!email || !password) {
      return buildApiError(
        'Email and password are required.',
        'MISSING_FIELDS',
        400,
        `Received: email=${email ? 'provided' : 'missing'}, password=${password ? 'provided' : 'missing'}`,
        endpoint,
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.passwordHash) {
      return buildApiError(
        'Invalid email or password.',
        'AUTH_INVALID_CREDENTIALS',
        401,
        `No user found with email "${email}" or the user has no password set. If you registered via OAuth, try signing in with that provider instead.`,
        endpoint,
      )
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return buildApiError(
        'Invalid email or password.',
        'AUTH_INVALID_CREDENTIALS',
        401,
        `Password verification failed for user "${email}". Check that you are using the correct password.`,
        endpoint,
      )
    }

    // Check if user is active (prevents banned / deactivated users from logging in)
    if (user.isActive === false) {
      return buildApiError(
        'Your account has been deactivated. Please contact the store owner.',
        'ACCOUNT_DEACTIVATED',
        403,
        `User "${email.toLowerCase()}" is inactive. An admin must re-activate the account.`,
        endpoint,
      )
    }

    // ─── Device-Limit Enforcement ────────────────────────────
    // Parse User-Agent + IP for session tracking
    const userAgent = request.headers.get('user-agent') || ''
    const ipAddress = getClientIp(request)
    const { deviceType, deviceName } = parseUserAgent(userAgent)

    // Enforce device limit BEFORE creating the new session
    const limitResult = await enforceDeviceLimit(user.id, user.role, deviceType)
    if (!limitResult.allowed) {
      return buildApiError(
        limitResult.reason || 'Device limit reached. Please log out from another device first.',
        'DEVICE_LIMIT_REACHED',
        403,
        `User "${email.toLowerCase()}" (role: ${user.role}) already has the maximum number of active sessions for their role. Active sessions: ${limitResult.remainingSessions.length}. New device type: ${deviceType}.`,
        endpoint,
      )
    }

    // Create session token (without sid first — we'll regenerate with sid)
    // We need the sid in the token, so we create the token, then create the
    // session row using the token hash, then re-create the token with the sid.
    const tokenWithoutSid = createSessionToken({
      uid: user.id,
      email: user.email,
      role: user.role,
      name: user.name || '',
    })

    // Create the session row using this token's hash
    const sid = await createSession(user.id, tokenWithoutSid, {
      deviceType,
      deviceName,
      userAgent,
      ipAddress,
    })

    // Regenerate the token with the sid embedded
    const token = createSessionToken({
      uid: user.id,
      email: user.email,
      role: user.role,
      name: user.name || '',
      sid,
    })

    // The token hash stored in the DB was based on the tokenWithoutSid.
    // We need to update it to use the final token hash so logout & revocation work.
    // (Or alternatively, store a deterministic hash that doesn't depend on the sid.)
    // For simplicity, update the session row's tokenHash to the final token's hash.
    const { hashSessionToken } = await import('@/lib/auth')
    const finalTokenHash = hashSessionToken(token)
    try {
      await prisma.session.update({
        where: { id: sid },
        data: { tokenHash: finalTokenHash },
      })
    } catch (err) {
      console.warn('[Auth] Failed to update session token hash:', err)
      // Non-critical — the session row exists, just the hash lookup on logout won't work.
      // The sid-based revocation still works.
    }

    // Build response with cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      // True for newly-created employee accounts that haven't reset their temp password yet.
      // The client uses this to redirect to /auth/reset-password after login.
      mustResetPassword: user.mustResetPassword === true,
      // Session info for the client (so login page can show "you replaced another session")
      sessionInfo: {
        deviceType,
        deviceName,
        revokedSessions: limitResult.revokedSessionIds.length,
      },
    })

    response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

    return response
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
