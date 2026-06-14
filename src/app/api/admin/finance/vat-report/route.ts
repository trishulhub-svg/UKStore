import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/finance/vat-report
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // 'today', 'week', 'month', 'quarter', 'year'

    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        const dayOfWeek = now.getDay() || 7
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1)
        break
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3
        startDate = new Date(now.getFullYear(), quarterMonth, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
    }

    // Get all order items in the period
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          storeId: STORE_ID,
          status: { in: ['delivered', 'out_for_delivery', 'ready', 'picking', 'placed'] },
          paymentStatus: 'paid',
          createdAt: { gte: startDate },
        },
      },
      select: {
        subtotal: true,
        vatRate: true,
        vatAmount: true,
        quantity: true,
        productName: true,
      },
    })

    // Group by VAT rate
    const vatBreakdown: Record<number, { netSales: number; vatAmount: number; grossSales: number; itemCount: number }> = {}

    for (const item of orderItems) {
      const rate = item.vatRate
      if (!vatBreakdown[rate]) {
        vatBreakdown[rate] = { netSales: 0, vatAmount: 0, grossSales: 0, itemCount: 0 }
      }
      vatBreakdown[rate].grossSales += item.subtotal
      vatBreakdown[rate].vatAmount += item.vatAmount
      vatBreakdown[rate].netSales += item.subtotal - item.vatAmount
      vatBreakdown[rate].itemCount += item.quantity
    }

    // Round values
    for (const rate of Object.keys(vatBreakdown)) {
      const b = vatBreakdown[parseFloat(rate)]
      b.netSales = Math.round(b.netSales * 100) / 100
      b.vatAmount = Math.round(b.vatAmount * 100) / 100
      b.grossSales = Math.round(b.grossSales * 100) / 100
    }

    // Total
    const totals = {
      netSales: Object.values(vatBreakdown).reduce((acc, b) => acc + b.netSales, 0),
      vatAmount: Object.values(vatBreakdown).reduce((acc, b) => acc + b.vatAmount, 0),
      grossSales: Object.values(vatBreakdown).reduce((acc, b) => acc + b.grossSales, 0),
    }

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      vatBreakdown,
      totals,
    })
  } catch (err) {
    console.error('[VAT Report GET]', err)
    return NextResponse.json({ error: 'Failed to generate VAT report' }, { status: 500 })
  }
}
