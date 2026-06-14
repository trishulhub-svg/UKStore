import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/analytics — aggregated stats
export async function GET() {
  const { error } = await requireAdmin()
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

    return NextResponse.json({
      summary: {
        totalProducts,
        totalOrders,
        totalCustomers,
        totalRevenue: totalRevenue._sum.total || 0,
        avgDeliveryMinutes: Math.round(avgDeliveryMinutes),
        deliveredCount: deliveredOrders.length,
      },
      revenueChart,
      statusPieChart,
      topProductsChart,
    })
  } catch (err) {
    console.error('[Admin Analytics GET]', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
