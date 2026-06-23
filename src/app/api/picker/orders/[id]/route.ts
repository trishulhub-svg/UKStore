import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requirePicker } from '@/lib/feature-permissions'
import { sendOrderStatusEmail } from '@/lib/email'

// PATCH /api/picker/orders/[id] — mark item as picked or mark order as packed
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requirePicker({ feature: 'picker_packing' })
  if (error) return error

  try {
    const { id } = await params
    const prisma = await getPrisma()
    const body = await request.json()
    const { itemId, picked, markPacked } = body

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, customer: { select: { id: true, name: true, email: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Mark individual item as picked
    if (itemId !== undefined) {
      await prisma.orderItem.update({
        where: { id: itemId },
        data: { picked: picked ?? true },
      })

      // If all items are now picked, auto-update order status to 'picking'
      const updatedItems = await prisma.orderItem.findMany({
        where: { orderId: id },
      })
      const allPicked = updatedItems.every((i) => i.picked)
      const somePicked = updatedItems.some((i) => i.picked)

      if (order.status === 'placed' && somePicked) {
        await prisma.order.update({
          where: { id },
          data: { status: 'picking' },
        })

        // Fire-and-forget email; no-ops if email not configured.
        sendOrderStatusEmail('picking', {
          orderId: order.id,
          customerName: order.customer.name || order.customer.email,
          customerEmail: order.customer.email,
          total: `£${order.total.toFixed(2)}`,
        }, { userId: order.customer.id }).catch((err) => {
          console.error('[Picker Orders PATCH] sendOrderStatusEmail (picking) failed:', err)
        })
      }

      return NextResponse.json({ success: true, allPicked })
    }

    // Mark order as packed (ready)
    if (markPacked) {
      const allPicked = order.items.every((i) => i.picked)
      if (!allPicked) {
        return NextResponse.json(
          { error: 'Not all items have been picked yet' },
          { status: 400 }
        )
      }

      await prisma.order.update({
        where: { id },
        data: {
          status: 'ready',
          packedAt: new Date(),
        },
      })

      // No customer email for 'ready' — it's an internal handoff state.
      // The customer will be notified when the order goes out_for_delivery.

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[Picker Orders PATCH]', err)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
