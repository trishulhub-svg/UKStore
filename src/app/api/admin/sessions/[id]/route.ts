import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { revokeSession } from '@/lib/session-manager'
import { invalidateSessionCache } from '@/lib/auth/server'

/**
 * DELETE /api/admin/sessions/[id]
 *
 * Revokes a single session by ID. The session's user will be logged out
 * on their next API request (the getServerUser() check will fail).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params
    const revoked = await revokeSession(id)
    invalidateSessionCache()

    if (!revoked) {
      return NextResponse.json(
        { error: 'Session not found or already revoked' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, revoked: 1 })
  } catch (err) {
    console.error('[Admin Session DELETE]', err)
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 })
  }
}
