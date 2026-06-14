import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// GET /api/user/notifications — list notifications
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = { userId: user.id }

    if (filter === 'unread') {
      where.isRead = false
    } else if (filter === 'orders') {
      where.type = 'order_update'
    } else if (filter === 'promotions') {
      where.type = 'promotion'
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ])

    return NextResponse.json({ notifications, total, unreadCount, page, limit })
  } catch (err) {
    console.error('[User Notifications GET]', err)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}
