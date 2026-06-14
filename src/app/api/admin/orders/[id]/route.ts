import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/orders/[id] — order detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const order = await prisma.order.findFirst({
      where: { id, storeId: STORE_ID },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        driver: { select: { id: true, name: true, email: true, phone: true } },
        address: true,
        items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[Admin Order GET]', err)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
