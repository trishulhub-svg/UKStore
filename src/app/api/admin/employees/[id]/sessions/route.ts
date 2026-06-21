import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { listUserSessions } from '@/lib/session-manager'

/**
 * GET /api/admin/employees/[id]/sessions
 *
 * Returns all active sessions for an employee (used by the admin
 * "Sessions" dialog to view and revoke device sessions).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, name: true, email: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const sessions = await listUserSessions(id)

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceType: s.deviceType,
        deviceName: s.deviceName,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[Admin Employee Sessions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}
