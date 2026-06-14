import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

/**
 * POST /api/admin/orders/[id]/verify-bank-transfer
 *
 * Admin endpoint to verify a bank transfer payment.
 * Sets bankTransferVerified: true and paymentStatus: 'paid'.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const order = await prisma.order.findFirst({
      where: { id, storeId: STORE_ID },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Validate that this order uses bank transfer
    if (order.paymentMethod !== 'bank_transfer') {
      return NextResponse.json(
        { error: 'This order is not a bank transfer payment' },
        { status: 400 }
      )
    }

    // Check if already verified
    if (order.bankTransferVerified) {
      return NextResponse.json(
        { error: 'Bank transfer has already been verified for this order' },
        { status: 400 }
      )
    }

    // Verify the bank transfer
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        bankTransferVerified: true,
        paymentStatus: 'paid',
      },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: { select: { id: true, productName: true, quantity: true } },
      },
    })

    // Create notification for customer
    try {
      await prisma.notification.create({
        data: {
          userId: order.customerId,
          type: 'order_update',
          title: 'Payment Verified',
          message: `Your bank transfer payment for order #${id.slice(-8)} has been verified. Your order is being processed.`,
          link: `/order/${id}`,
        },
      })
    } catch {
      // Notification creation is non-critical
    }

    console.log(`[Admin Bank Transfer Verify] Order ${id} bank transfer verified by ${user!.id}`)

    return NextResponse.json({
      order: updatedOrder,
      message: 'Bank transfer payment verified successfully.',
    })
  } catch (err) {
    console.error('[Admin Bank Transfer Verify POST]', err)
    return NextResponse.json(
      { error: 'Failed to verify bank transfer' },
      { status: 500 }
    )
  }
}
