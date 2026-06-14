import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// PATCH /api/user/notifications/[id] — mark as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()
    const { isRead, markAllRead } = body

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true })
    }

    const existing = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: isRead !== undefined ? isRead : true },
    })

    return NextResponse.json({ notification })
  } catch (err) {
    console.error('[User Notification PATCH]', err)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}
