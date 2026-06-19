import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

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
 *
 * Email changes are NOT allowed here — only the store owner can change
 * email addresses (via /api/admin/employees/[id]).
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

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error('[User Profile PATCH]', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
