import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireDriver } from '@/lib/feature-permissions'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/driver/earnings — earnings summary
export async function GET() {
  const { error, user } = await requireDriver({ feature: 'driver_earnings' })
  if (error) return error

  try {
    const prisma = await getPrisma()

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Completed deliveries for different time periods
    const [todayDeliveries, weekDeliveries, monthDeliveries] = await Promise.all([
      prisma.order.findMany({
        where: {
          storeId: STORE_ID,
          driverId: user.id,
          status: 'delivered',
          updatedAt: { gte: todayStart },
        },
        include: {
          customer: { select: { name: true } },
          address: { select: { addressLine1: true, postcode: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.order.findMany({
        where: {
          storeId: STORE_ID,
          driverId: user.id,
          status: 'delivered',
          updatedAt: { gte: weekStart },
        },
        include: {
          customer: { select: { name: true } },
          address: { select: { addressLine1: true, postcode: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.order.findMany({
        where: {
          storeId: STORE_ID,
          driverId: user.id,
          status: 'delivered',
          updatedAt: { gte: monthStart },
        },
        include: {
          customer: { select: { name: true } },
          address: { select: { addressLine1: true, postcode: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    // Delivery fee is the driver's earning per delivery
    const todayEarnings = todayDeliveries.reduce((sum, o) => sum + o.deliveryFee, 0)
    const weekEarnings = weekDeliveries.reduce((sum, o) => sum + o.deliveryFee, 0)
    const monthEarnings = monthDeliveries.reduce((sum, o) => sum + o.deliveryFee, 0)

    return NextResponse.json({
      today: { deliveries: todayDeliveries.length, earnings: todayEarnings, orders: todayDeliveries },
      thisWeek: { deliveries: weekDeliveries.length, earnings: weekEarnings, orders: weekDeliveries },
      thisMonth: { deliveries: monthDeliveries.length, earnings: monthEarnings, orders: monthDeliveries },
    })
  } catch (err) {
    console.error('[Driver Earnings GET]', err)
    return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 })
  }
}
