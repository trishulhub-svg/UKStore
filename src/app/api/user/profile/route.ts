import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth'

/**
 * GET /api/user/profile — returns the current user's profile
 * Any authenticated user can fetch their own profile.
 */
export async function GET() {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const prisma = await getPrisma()
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        mustResetPassword: true,
        createdAt: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: dbUser })
  } catch (err) {
    console.error('[User Profile GET]', err)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

/**
 * PATCH /api/user/profile — self-service profile update.
 *
 * The currently logged-in user can update their own:
 *   - name
 *   - phone
 *   - avatarUrl
 *   - email (OWNER only — managers/drivers/pickers/customers must ask the owner)
 *
 * When an OWNER changes their email, the session cookie is re-issued so the
 * new email takes effect immediately (the token payload contains the email).
 *
 * Password changes are NOT done here — use /api/auth/reset-password which
 * verifies the current password first.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim()
    }
    if (typeof body.phone === 'string') {
      data.phone = body.phone.trim() || null
    }
    if (typeof body.avatarUrl === 'string') {
      data.avatarUrl = body.avatarUrl || null
    }

    // Email change — OWNER only.
    // The owner is the only role allowed to self-change email. Managers,
    // drivers, pickers, and customers must ask the owner to do it for them
    // (via /admin/employees).
    let emailChanged = false
    if (typeof body.email === 'string' && body.email.trim()) {
      const isOwner = user.role === 'OWNER' || user.role === 'owner'
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only the store owner can change their own email address. Please ask the store owner to update it for you.' },
          { status: 403 }
        )
      }
      const newEmail = body.email.toLowerCase().trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
      // Check uniqueness (excluding the current user)
      const prisma = await getPrisma()
      const emailOwner = await prisma.user.findUnique({ where: { email: newEmail } })
      if (emailOwner && emailOwner.id !== user.id) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      data.email = newEmail
      emailChanged = true
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    const prisma = await getPrisma()
    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatarUrl: true,
        mustResetPassword: true,
      },
    })

    // If the owner changed their email, re-issue the session token so the
    // new email is reflected in the token payload. The cookie's maxAge is
    // preserved (sliding window still works as before — the token gets a
    // fresh iat).
    const response = NextResponse.json({ user: updated })
    if (emailChanged) {
      const freshToken = createSessionToken({
        uid: updated.id,
        email: updated.email,
        role: updated.role,
        // Fall back to email local-part if name is null — token payload
        // requires a non-null name string.
        name: updated.name || updated.email.split('@')[0],
      })
      response.cookies.set(SESSION_COOKIE_NAME, freshToken, SESSION_COOKIE_OPTIONS)
    }

    return response
  } catch (err) {
    console.error('[User Profile PATCH]', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
