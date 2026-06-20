// ============================================================
// Admin Order Refund API
// POST /api/admin/orders/[id]/refund
// Processes refund via Stripe (if applicable), updates order
// status to cancelled, paymentStatus to refunded, and notifies
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getPrisma } from '@/lib/auth/prisma'
import { getStripeConfig } from '@/lib/settings'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify admin
  const { error: authError } = await requireAdmin({ feature: 'orders' })
  if (authError) return authError

  try {
    const { id: orderId } = await params
    const prisma = await getPrisma()

    // Parse request body
    let body: { reason?: string; amount?: number }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { reason, amount } = body

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'A reason for the refund is required' },
        { status: 400 }
      )
    }

    // Find the order
    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check if order can be refunded
    if (order.paymentStatus === 'refunded') {
      return NextResponse.json(
        { error: 'Order has already been refunded' },
        { status: 400 }
      )
    }

    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'pending') {
      return NextResponse.json(
        { error: `Order with payment status "${order.paymentStatus}" cannot be refunded` },
        { status: 400 }
      )
    }

    if (order.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Order is already cancelled' },
        { status: 400 }
      )
    }

    // Determine refund amount (full or partial)
    const refundAmount = amount && amount > 0 && amount <= order.total
      ? amount
      : order.total

    let stripeRefundId: string | null = null

    // If paid via Stripe with a payment intent, create a Stripe refund
    if (
      order.paymentMethod === 'stripe' &&
      order.stripePaymentIntentId &&
      order.paymentStatus === 'paid'
    ) {
      const stripeConfig = await getStripeConfig()

      if (stripeConfig.isConfigured && stripeConfig.secretKey) {
        try {
          let Stripe: any
          try {
            Stripe = (await import('stripe')).default
          } catch {
            console.warn('[Refund] Stripe package not installed, skipping Stripe refund')
          }

          if (Stripe) {
            const stripe = new Stripe(stripeConfig.secretKey, {
              apiVersion: '2025-04-30.basil',
            })

            const refundParams: Record<string, any> = {
              payment_intent: order.stripePaymentIntentId,
              amount: Math.round(refundAmount * 100), // Convert to pence
              reason: 'requested_by_customer',
              metadata: {
                orderId: order.id,
                refundReason: reason.trim(),
                refundedBy: 'admin',
              },
            }

            // If partial refund, specify the amount
            if (refundAmount < order.total) {
              refundParams.amount = Math.round(refundAmount * 100)
            }

            const refund = await stripe.refunds.create(refundParams)
            stripeRefundId = refund.id

            console.log(
              `[Refund] Stripe refund created: ${refund.id} for order ${order.id} (amount: £${refundAmount.toFixed(2)})`
            )
          }
        } catch (stripeError) {
          console.error('[Refund] Stripe refund failed:', stripeError)
          // Continue with marking the order as refunded in our DB
          // The admin can handle the Stripe refund manually
        }
      }
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        paymentStatus: 'refunded',
        notes: order.notes
          ? `${order.notes}\n[REFUND] £${refundAmount.toFixed(2)} refunded. Reason: ${reason.trim()}. Stripe Refund ID: ${stripeRefundId || 'N/A'}`
          : `[REFUND] £${refundAmount.toFixed(2)} refunded. Reason: ${reason.trim()}. Stripe Refund ID: ${stripeRefundId || 'N/A'}`,
      },
    })

    // Create notification for the customer
    try {
      await prisma.notification.create({
        data: {
          userId: order.customerId,
          type: 'order_update',
          title: 'Order Refunded',
          message: `Your order #${order.id.slice(-8).toUpperCase()} has been refunded £${refundAmount.toFixed(2)}. Reason: ${reason.trim()}`,
          link: `/order/${order.id}`,
        },
      })
    } catch {
      // Notification creation is non-critical
    }

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
      },
      refund: {
        amount: refundAmount,
        reason: reason.trim(),
        stripeRefundId,
      },
    })
  } catch (err) {
    console.error('[Refund] Error processing refund:', err)
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    )
  }
}
