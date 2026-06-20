import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireDriver } from '@/lib/feature-permissions'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/driver/orders — list assigned + available orders
export async function GET(request: NextRequest) {
  const { error, user } = await requireDriver({ feature: 'driver_dashboard' })
  if (error) return error

  try {
    const prisma = await getPrisma()

    // Orders assigned to this driver
    const assignedOrders = await prisma.order.findMany({
      where: {
        storeId: STORE_ID,
        driverId: user.id,
        status: { in: ['picking', 'ready', 'out_for_delivery'] },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        address: true,
        items: {
          include: {
            product: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Available orders (ready but no driver assigned)
    const availableOrders = await prisma.order.findMany({
      where: {
        storeId: STORE_ID,
        driverId: null,
        status: { in: ['picking', 'ready'] },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        address: true,
        items: {
          include: {
            product: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Quick stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday

    const completedToday = await prisma.order.count({
      where: {
        storeId: STORE_ID,
        driverId: user.id,
        status: 'delivered',
        updatedAt: { gte: today },
      },
    })

    const completedThisWeek = await prisma.order.count({
      where: {
        storeId: STORE_ID,
        driverId: user.id,
        status: 'delivered',
        updatedAt: { gte: startOfWeek },
      },
    })

    const pickingCount = await prisma.order.count({
      where: {
        storeId: STORE_ID,
        driverId: user.id,
        status: 'picking',
      },
    })

    return NextResponse.json({
      assignedOrders,
      availableOrders,
      stats: {
        completedToday,
        completedThisWeek,
        pickingCount,
      },
    })
  } catch (err) {
    console.error('[Driver Orders GET]', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
