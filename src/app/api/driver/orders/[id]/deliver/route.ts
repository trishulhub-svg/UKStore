import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// POST /api/driver/orders/[id]/deliver — confirm delivery
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (user.role.toLowerCase() !== 'driver') {
    return NextResponse.json({ error: 'Forbidden — driver role required' }, { status: 403 })
  }

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()
    const { photoUrl, signatureData } = body

    const order = await prisma.order.findFirst({
      where: { id, storeId: STORE_ID, driverId: user.id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'out_for_delivery') {
      return NextResponse.json(
        { error: 'Order must be out for delivery before confirming' },
        { status: 400 }
      )
    }

    // Update order status to delivered
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: 'delivered' },
      include: {
        customer: { select: { id: true, name: true } },
        address: true,
        items: true,
      },
    })

    // Create notification for customer
    await prisma.notification.create({
      data: {
        userId: order.customerId,
        type: 'order_update',
        title: 'Order Delivered',
        message: `Your order #${id.slice(-8)} has been delivered successfully!`,
        link: `/orders/${id}/track`,
      },
    })

    return NextResponse.json({
      order: updatedOrder,
      deliveryProof: { photoUrl: photoUrl || null, signatureData: signatureData || null },
    })
  } catch (err) {
    console.error('[Driver Order Deliver POST]', err)
    return NextResponse.json({ error: 'Failed to confirm delivery' }, { status: 500 })
  }
}
