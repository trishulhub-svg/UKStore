import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { generateAndSaveReceipt, resendReceiptEmail } from '@/lib/receipt'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

/**
 * GET /api/admin/orders/[id]/receipt
 *
 * Returns the saved receipt HTML for an order. If no receipt exists yet
 * (e.g. payment was confirmed before the receipt feature shipped, or
 * the webhook fired before this code path landed), one is generated on
 * the fly so the admin always sees something useful.
 *
 * Query params:
 *   - format=html  → returns text/html (default; renders in browser)
 *   - format=json  → returns JSON with receiptNumber + receiptHtml + sentAt
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'orders' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'html'

    let order = await prisma.order.findFirst({
      where: { id, storeId: STORE_ID },
      select: {
        id: true,
        receiptNumber: true,
        receiptHtml: true,
        receiptSentAt: true,
        paymentStatus: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // If no receipt yet but the order is paid, generate one on the fly.
    // (covers orders paid before this feature shipped + webhook races)
    if (!order.receiptHtml || !order.receiptNumber) {
      if (order.paymentStatus === 'paid') {
        await generateAndSaveReceipt(id).catch((err) => {
          console.error(`[Admin Receipt GET] On-demand generation failed for ${id}:`, err)
        })
        order = await prisma.order.findFirst({
          where: { id, storeId: STORE_ID },
          select: {
            id: true,
            receiptNumber: true,
            receiptHtml: true,
            receiptSentAt: true,
            paymentStatus: true,
          },
        }) || order
      } else {
        return NextResponse.json(
          { error: 'Receipt not available — payment has not been confirmed yet.' },
          { status: 404 },
        )
      }
    }

    if (!order.receiptHtml || !order.receiptNumber) {
      return NextResponse.json(
        { error: 'Receipt could not be generated.' },
        { status: 500 },
      )
    }

    if (format === 'json') {
      return NextResponse.json({
        orderId: order.id,
        receiptNumber: order.receiptNumber,
        receiptHtml: order.receiptHtml,
        receiptSentAt: order.receiptSentAt?.toISOString() ?? null,
      })
    }

    // Default: serve as HTML for direct browser viewing / iframe embedding
    return new NextResponse(order.receiptHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[Admin Receipt GET]', err)
    return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 })
  }
}

/**
 * POST /api/admin/orders/[id]/receipt
 *
 * Resend the receipt email to the customer. Useful when the owner just
 * configured SMTP credentials and wants to deliver previously-stored
 * receipts, or when a customer reports they didn't receive the first one.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'orders' })
  if (error) return error

  try {
    const { id } = await params
    const prisma = await getPrisma()

    // Make sure a receipt exists first
    const order = await prisma.order.findFirst({
      where: { id, storeId: STORE_ID },
      select: { receiptNumber: true, receiptHtml: true, paymentStatus: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.receiptNumber || !order.receiptHtml) {
      // Generate on-demand if payment is confirmed
      if (order.paymentStatus === 'paid') {
        await generateAndSaveReceipt(id)
      } else {
        return NextResponse.json(
          { error: 'Receipt not available — payment not confirmed yet.' },
          { status: 400 },
        )
      }
    }

    const result = await resendReceiptEmail(id)
    if (result.sent) {
      return NextResponse.json({ message: 'Receipt email sent.' })
    }
    return NextResponse.json(
      { error: `Failed to send receipt email: ${result.reason || 'unknown'}`,
        detail: result.error },
      { status: 400 },
    )
  } catch (err) {
    console.error('[Admin Receipt POST]', err)
    return NextResponse.json({ error: 'Failed to resend receipt' }, { status: 500 })
  }
}
