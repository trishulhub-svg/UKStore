import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/user/orders/[id] — order detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const order = await prisma.order.findFirst({
      where: { id, customerId: user.id, storeId: STORE_ID },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                slug: true,
                price: true,
                category: { select: { name: true } },
              },
            },
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            driverProfile: { select: { vehicleType: true, vehicleReg: true } },
          },
        },
        address: true,
        store: { select: { name: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[User Order GET]', err)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
