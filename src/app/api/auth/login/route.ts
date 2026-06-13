import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth'

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

    const { email, password } = body

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
      where: { email: email.toLowerCase() },
    })

    if (!user || !user.passwordHash) {
      return buildApiError(
        'Invalid email or password.',
        'AUTH_INVALID_CREDENTIALS',
        401,
        `No user found with email "${email.toLowerCase()}" or the user has no password set. If you registered via OAuth, try signing in with that provider instead.`,
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
        `Password verification failed for user "${email.toLowerCase()}". Check that you are using the correct password.`,
        endpoint,
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
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    const errStack = error instanceof Error ? error.stack || '' : ''
    console.error('[Auth] Login error:', error)
    return buildApiError(
      'An internal server error occurred during login.',
      'INTERNAL_ERROR',
      500,
      `Error: ${errMessage}\n${errStack}`,
      endpoint,
    )
  }
}
