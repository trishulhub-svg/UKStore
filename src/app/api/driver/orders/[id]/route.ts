import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/driver/orders/[id] — order detail with pick list
export async function GET(
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

    const order = await prisma.order.findFirst({
      where: { id, storeId: STORE_ID },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        driver: { select: { id: true, name: true } },
        address: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                barcode: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only allow if assigned to this driver or available (no driver)
    if (order.driverId && order.driverId !== user.id) {
      return NextResponse.json({ error: 'Not assigned to you' }, { status: 403 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[Driver Order GET]', err)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

// PATCH /api/driver/orders/[id] — update item picked status, change order status
export async function PATCH(
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
    const { itemId, picked, status, assignToMe, challenge25Verified } = body

    const order = await prisma.order.findFirst({
      where: { id, storeId: STORE_ID },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Assign order to driver
    if (assignToMe && !order.driverId) {
      await prisma.order.update({
        where: { id },
        data: { driverId: user.id },
      })
    }

    // Update item picked status
    if (itemId !== undefined) {
      await prisma.orderItem.update({
        where: { id: itemId },
        data: { picked: !!picked },
      })
    }

    // Update Challenge 25 verification status
    if (challenge25Verified !== undefined) {
      if (!order.hasChallenge25) {
        return NextResponse.json(
          { error: 'This order does not require Challenge 25 verification' },
          { status: 400 }
        )
      }
      if (order.challenge25Verified) {
        return NextResponse.json(
          { error: 'Challenge 25 verification already completed' },
          { status: 400 }
        )
      }
      await prisma.order.update({
        where: { id },
        data: { challenge25Verified: true },
      })
    }

    // Update order status
    if (status) {
      // If order has Challenge 25 and is being marked as delivered, ensure verification is done
      if (status === 'delivered' && order.hasChallenge25 && !order.challenge25Verified && !challenge25Verified) {
        return NextResponse.json(
          { error: 'Cannot mark as delivered: Challenge 25 age verification required first' },
          { status: 400 }
        )
      }

      const validTransitions: Record<string, string[]> = {
        placed: ['picking'],
        picking: ['ready'],
        ready: ['out_for_delivery'],
        out_for_delivery: ['delivered'],
      }

      const allowed = validTransitions[order.status] || []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${order.status} to ${status}` },
          { status: 400 }
        )
      }

      await prisma.order.update({
        where: { id },
        data: {
          status,
          driverId: order.driverId || user.id,
        },
      })
    }

    // Return updated order
    const updatedOrder = await prisma.order.findFirst({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        address: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                barcode: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ order: updatedOrder })
  } catch (err) {
    console.error('[Driver Order PATCH]', err)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
