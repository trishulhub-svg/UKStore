import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { revokeSession, revokeAllUserSessions } from '@/lib/session-manager'
import { invalidateSessionCache } from '@/lib/auth/server'

/**
 * GET /api/admin/sessions
 *
 * Lists all active sessions across all employees (OWNER/DRIVER/PICKER/MANAGER).
 * Used by the admin sessions page to monitor device usage.
 *
 * Query params:
 *   - userId: filter by user ID (optional)
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const userIdFilter = searchParams.get('userId')

    // Clean up expired sessions
    try {
      await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
    } catch {
      // Non-critical
    }

    const where = userIdFilter ? { userId: userIdFilter } : {}
    const sessions = await prisma.session.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { lastSeenAt: 'desc' },
    })

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        deviceType: s.deviceType,
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        user: s.user,
      })),
    })
  } catch (err) {
    console.error('[Admin Sessions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/sessions
 *
 * Bulk revoke sessions. Body:
 *   - { userId: string } → revoke ALL sessions for that user
 *   - { allEmployees: true } → revoke ALL sessions for ALL employees
 *
 * For revoking a single session, use DELETE /api/admin/sessions/[id].
 */
export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json().catch(() => ({}))
    const prisma = await getPrisma()

    if (body.userId) {
      const count = await revokeAllUserSessions(body.userId)
      invalidateSessionCache()
      return NextResponse.json({ success: true, revoked: count })
    }

    if (body.allEmployees) {
      // Revoke all sessions for non-customer users
      const employees = await prisma.user.findMany({
        where: { role: { in: ['DRIVER', 'PICKER', 'OWNER', 'MANAGER'] } },
        select: { id: true },
      })
      let total = 0
      for (const emp of employees) {
        total += await revokeAllUserSessions(emp.id)
      }
      invalidateSessionCache()
      return NextResponse.json({ success: true, revoked: total })
    }

    return NextResponse.json(
      { error: 'Provide { userId } or { allEmployees: true } in the body' },
      { status: 400 }
    )
  } catch (err) {
    console.error('[Admin Sessions DELETE]', err)
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 })
  }
}
