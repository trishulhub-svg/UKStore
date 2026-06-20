import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/analytics — aggregated stats
export async function GET() {
  const { error } = await requireAdmin({ feature: 'analytics' })
  if (error) return error

  try {
    const prisma = await getPrisma()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Revenue last 30 days (daily)
    const ordersLast30 = await prisma.order.findMany({
      where: {
        storeId: STORE_ID,
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'cancelled' },
      },
      select: { total: true, createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    })

    // Group revenue by day
    const revenueByDay: Record<string, number> = {}
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      revenueByDay[key] = 0
    }
    ordersLast30.forEach((o) => {
      const key = o.createdAt.toISOString().split('T')[0]
      if (key in revenueByDay) {
        revenueByDay[key] += o.total
      }
    })

    const revenueChart = Object.entries(revenueByDay).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
    }))

    // Orders by status
    const allOrders = await prisma.order.findMany({
      where: { storeId: STORE_ID },
      select: { status: true },
    })
    const ordersByStatus: Record<string, number> = {}
    allOrders.forEach((o) => {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1
    })

    const statusPieChart = Object.entries(ordersByStatus).map(([status, count]) => ({
      status,
      count,
    }))

    // Top selling products (by quantity in order items)
    const topProductsRaw = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    })

    const topProductsChart = topProductsRaw.map((p) => ({
      name: p.productName,
      quantity: p._sum.quantity || 0,
      revenue: p._sum.subtotal || 0,
    }))

    // Delivery performance
    const deliveredOrders = await prisma.order.findMany({
      where: { storeId: STORE_ID, status: 'delivered' },
      select: { createdAt: true, updatedAt: true },
    })

    const avgDeliveryMinutes = deliveredOrders.length > 0
      ? deliveredOrders.reduce((sum, o) => {
          const diff = o.updatedAt.getTime() - o.createdAt.getTime()
          return sum + diff / (1000 * 60)
        }, 0) / deliveredOrders.length
      : 0

    // Summary stats
    const [
      totalProducts,
      totalOrders,
      totalCustomers,
      totalRevenue,
    ] = await Promise.all([
      prisma.product.count({ where: { storeId: STORE_ID } }),
      prisma.order.count({ where: { storeId: STORE_ID } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.order.aggregate({
        where: { storeId: STORE_ID, status: { not: 'cancelled' } },
        _sum: { total: true },
      }),
    ])

    // ─── Wastage analytics ────────────────────────────────────────────────
    // 1. Wastage by reason (pie chart)
    // 2. Wastage cost over last 30 days (line chart)
    // 3. Top 10 products by total wastage cost (bar chart)
    const wastageLogs = await prisma.wastageLog.findMany({
      where: { product: { storeId: STORE_ID } },
      include: { product: { select: { name: true, price: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const wastageByReason: Record<string, { count: number; cost: number }> = {}
    const wastageByDay: Record<string, number> = {}
    const wastageByProduct: Record<string, { name: string; count: number; cost: number }> = {}

    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      wastageByDay[key] = 0
    }

    for (const log of wastageLogs) {
      const reason = log.reason || 'other'
      const cost = (log.product?.price ?? 0) * log.quantity
      if (!wastageByReason[reason]) wastageByReason[reason] = { count: 0, cost: 0 }
      wastageByReason[reason].count += log.quantity
      wastageByReason[reason].cost += cost

      const dayKey = log.createdAt.toISOString().split('T')[0]
      if (dayKey in wastageByDay) wastageByDay[dayKey] += cost

      const productName = log.product?.name ?? 'Unknown'
      if (!wastageByProduct[productName]) wastageByProduct[productName] = { name: productName, count: 0, cost: 0 }
      wastageByProduct[productName].count += log.quantity
      wastageByProduct[productName].cost += cost
    }

    const wastageReasonChart = Object.entries(wastageByReason).map(([reason, data]) => ({
      reason,
      count: data.count,
      cost: Math.round(data.cost * 100) / 100,
    }))

    const wastageTrendChart = Object.entries(wastageByDay).map(([date, cost]) => ({
      date,
      cost: Math.round(cost * 100) / 100,
    }))

    const wastageTopProductsChart = Object.values(wastageByProduct)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        quantity: p.count,
        cost: Math.round(p.cost * 100) / 100,
      }))

    const totalWastageCost = wastageLogs.reduce((sum, l) => sum + (l.product?.price ?? 0) * l.quantity, 0)

    return NextResponse.json({
      summary: {
        totalProducts,
        totalOrders,
        totalCustomers,
        totalRevenue: totalRevenue._sum.total || 0,
        avgDeliveryMinutes: Math.round(avgDeliveryMinutes),
        deliveredCount: deliveredOrders.length,
        totalWastageCost: Math.round(totalWastageCost * 100) / 100,
        wastageEntryCount: wastageLogs.length,
      },
      revenueChart,
      statusPieChart,
      topProductsChart,
      wastageReasonChart,
      wastageTrendChart,
      wastageTopProductsChart,
    })
  } catch (err) {
    console.error('[Admin Analytics GET]', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
