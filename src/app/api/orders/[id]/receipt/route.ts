import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { generateAndSaveReceipt } from '@/lib/receipt'

/**
 * GET /api/orders/[id]/receipt
 *
 * Public endpoint — returns the order's receipt HTML. The order ID
 * (cuid) is unguessable in practice, which matches the existing
 * visibility model (the customer's order-confirmation page at
 * /order/[id] is also public).
 *
 * Query params:
 *   - format=html  → returns text/html (default; renders in browser)
 *   - format=json  → returns JSON with receiptNumber + receiptHtml
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'html'

    let order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        receiptNumber: true,
        receiptHtml: true,
        paymentStatus: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // If no receipt yet but order is paid, generate on the fly
    if (!order.receiptHtml || !order.receiptNumber) {
      if (order.paymentStatus === 'paid') {
        await generateAndSaveReceipt(id).catch((err) => {
          console.error(`[Public Receipt GET] On-demand generation failed for ${id}:`, err)
        })
        order = await prisma.order.findUnique({
          where: { id },
          select: {
            id: true,
            receiptNumber: true,
            receiptHtml: true,
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
      })
    }

    return new NextResponse(order.receiptHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[Public Receipt GET]', err)
    return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 })
  }
}
