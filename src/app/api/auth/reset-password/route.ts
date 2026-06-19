import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { getServerUser } from '@/lib/auth/server'

/**
 * POST /api/auth/reset-password
 *
 * Used by:
 *   - New employees on first login (mustResetPassword=true) — forced reset
 *   - Any logged-in user changing their own password from the profile page
 *
 * Body:
 *   - currentPassword: string (required, verified against the existing hash)
 *   - newPassword: string (required, min 8 chars)
 *
 * The current-password check is skipped when `?forced=1` is in the URL AND
 * the user has mustResetPassword=true — this is the first-login flow where
 * the user just typed their temp password to log in.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const prisma = await getPrisma()
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const isForced = url.searchParams.get('forced') === '1'

    // For forced reset (first login), skip the currentPassword check ONLY if
    // the user is flagged mustResetPassword. Otherwise require current password.
    if (!(isForced && dbUser.mustResetPassword)) {
      if (typeof currentPassword !== 'string' || !currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required' },
          { status: 400 }
        )
      }
      const ok = await verifyPassword(currentPassword, dbUser.passwordHash)
      if (!ok) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        )
      }
    }

    // Don't allow reusing the same password
    const isSame = await verifyPassword(newPassword, dbUser.passwordHash)
    if (isSame) {
      return NextResponse.json(
        { error: 'New password must be different from the current password' },
        { status: 400 }
      )
    }

    const newHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustResetPassword: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Reset Password POST]', err)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
