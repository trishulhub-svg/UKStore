import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getStripeConfig } from '@/lib/settings'

/**
 * Stripe Webhook Handler
 *
 * Handles incoming webhook events from Stripe.
 * Uses raw body for signature verification (required by Stripe).
 *
 * Events handled:
 * - checkout.session.completed: Marks order as paid
 * - payment_intent.payment_failed: Marks order payment as failed
 */
export async function POST(request: NextRequest) {
  // Get the raw body as text for signature verification
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('[Stripe Webhook] Missing stripe-signature header')
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  // Get Stripe config (webhook secret)
  const stripeConfig = await getStripeConfig()

  if (!stripeConfig.secretKey || !stripeConfig.webhookSecret) {
    console.error('[Stripe Webhook] Stripe not configured (missing secret key or webhook secret)')
    return NextResponse.json(
      { error: 'Stripe webhook not configured' },
      { status: 500 }
    )
  }

  // Dynamically import Stripe to avoid issues if not installed
  let Stripe: any
  try {
    Stripe = (await import('stripe')).default
  } catch {
    console.error('[Stripe Webhook] Stripe package not installed')
    return NextResponse.json(
      { error: 'Stripe package not installed' },
      { status: 500 }
    )
  }

  const stripe = new Stripe(stripeConfig.secretKey, {
    apiVersion: '2025-04-30.basil',
  })

  // Verify the webhook signature using the raw body
  let event: any
  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeConfig.webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Stripe Webhook] Signature verification failed:', message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  // Process the event — return 200 quickly as Stripe expects fast responses
  // We process asynchronously but still return 200 immediately
  try {
    const prisma = await getPrisma()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const sessionId = session.id
        const orderIdFromMetadata = session.metadata?.orderId

        // Find the order by stripeSessionId (primary) or metadata orderId (fallback)
        let order = null

        if (orderIdFromMetadata) {
          order = await prisma.order.findFirst({
            where: { id: orderIdFromMetadata },
          })
        }

        if (!order) {
          order = await prisma.order.findFirst({
            where: { stripeSessionId: sessionId },
          })
        }

        if (order) {
          // Update payment status to paid
          const updateData: Record<string, any> = {
            paymentStatus: 'paid',
            stripePaymentIntentId: session.payment_intent || null,
          }

          // If order is still in 'placed' status and payment is confirmed,
          // keep it in placed — the driver/picker workflow handles transitions
          // But if the order was somehow stuck, we ensure it's at least 'placed'
          if (order.status === 'cancelled') {
            // Don't update cancelled orders
            console.warn(`[Stripe Webhook] Order ${order.id} is cancelled, skipping payment update`)
          } else {
            await prisma.order.update({
              where: { id: order.id },
              data: updateData,
            })
          }

          console.log(`[Stripe Webhook] Order ${order.id} payment confirmed (session: ${sessionId})`)

          // Create notification for customer
          try {
            await prisma.notification.create({
              data: {
                userId: order.customerId,
                type: 'order_update',
                title: 'Payment Confirmed',
                message: `Payment for order #${order.id.slice(-8)} has been confirmed.`,
                link: `/order/${order.id}`,
              },
            })
          } catch {
            // Notification creation is non-critical
          }
        } else {
          console.warn(`[Stripe Webhook] No order found for session ${sessionId} (metadata orderId: ${orderIdFromMetadata})`)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object
        const paymentIntentId = paymentIntent.id

        // Find the order by stripePaymentIntentId or by session
        const order = await prisma.order.findFirst({
          where: {
            OR: [
              { stripePaymentIntentId: paymentIntentId },
              { stripeSessionId: { contains: paymentIntentId } },
            ],
          },
        })

        if (order) {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'failed' },
          })

          console.log(`[Stripe Webhook] Order ${order.id} payment failed (payment_intent: ${paymentIntentId})`)

          // Notify customer
          try {
            await prisma.notification.create({
              data: {
                userId: order.customerId,
                type: 'order_update',
                title: 'Payment Failed',
                message: `Payment for order #${order.id.slice(-8)} has failed. Please try again.`,
                link: `/order/${order.id}`,
              },
            })
          } catch {
            // Notification creation is non-critical
          }
        } else {
          console.warn(`[Stripe Webhook] No order found for failed payment_intent: ${paymentIntentId}`)
        }
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('[Stripe Webhook] Error processing event:', err)
    // Still return 200 so Stripe doesn't retry for processing errors
    // (We've already verified the signature, so the event is legitimate)
  }

  // Return 200 quickly — Stripe expects fast responses
  return NextResponse.json({ received: true })
}
