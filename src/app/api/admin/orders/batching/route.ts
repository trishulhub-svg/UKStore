import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/orders/batching — Suggest batches based on postcode area prefix
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()

    // Get active orders (not delivered or cancelled) that have no batch group assigned yet
    const orders = await prisma.order.findMany({
      where: {
        storeId: STORE_ID,
        status: { in: ['placed', 'picking', 'ready'] },
        batchGroup: null,
      },
      include: {
        customer: { select: { id: true, name: true } },
        address: { select: { postcode: true, addressLine1: true, city: true } },
        driver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Group by postcode area prefix (e.g., "KT1", "SW1A")
    const postcodeGroups: Record<string, typeof orders> = {}

    for (const order of orders) {
      const postcode = order.address.postcode.trim()
      // Extract the outward code (e.g., "KT1" from "KT1 2AB")
      const match = postcode.match(/^([A-Z]{1,2}\d[A-Z\d]?)/i)
      const area = match ? match[1].toUpperCase() : postcode.substring(0, 3).toUpperCase()

      if (!postcodeGroups[area]) {
        postcodeGroups[area] = []
      }
      postcodeGroups[area].push(order)
    }

    // Only include groups with 2+ orders
    const batches = Object.entries(postcodeGroups)
      .filter(([, orders]) => orders.length >= 2)
      .map(([area, orders]) => ({
        area,
        orderCount: orders.length,
        orders: orders.map((o) => ({
          id: o.id,
          status: o.status,
          total: o.total,
          customerName: o.customer.name || 'Unknown',
          postcode: o.address.postcode,
          addressLine1: o.address.addressLine1,
          driver: o.driver ? { id: o.driver.id, name: o.driver.name } : null,
          createdAt: o.createdAt.toISOString(),
        })),
      }))
      .sort((a, b) => b.orderCount - a.orderCount)

    return NextResponse.json({ batches })
  } catch (err) {
    console.error('[Order Batching GET]', err)
    return NextResponse.json({ error: 'Failed to generate batch suggestions' }, { status: 500 })
  }
}

// POST /api/admin/orders/batching — Assign a batch to a driver
export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { orderIds, driverId, batchGroup } = body as {
      orderIds?: string[]
      driverId?: string
      batchGroup?: string
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds array is required' }, { status: 400 })
    }

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 })
    }

    // Verify driver exists and has driver role
    const driver = await prisma.user.findFirst({
      where: { id: driverId, role: 'DRIVER' },
    })

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    // Generate a batch group name if not provided
    const groupName = batchGroup || `BATCH-${Date.now().toString(36).toUpperCase()}`

    // Update all orders: assign batch group and driver
    await prisma.$transaction(
      orderIds.map((orderId) =>
        prisma.order.update({
          where: { id: orderId },
          data: {
            batchGroup: groupName,
            driverId,
            status: 'out_for_delivery',
            dispatchedAt: new Date(),
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      batchGroup: groupName,
      assignedOrders: orderIds.length,
      driverName: driver.name,
    })
  } catch (err) {
    console.error('[Order Batching POST]', err)
    return NextResponse.json({ error: 'Failed to assign batch' }, { status: 500 })
  }
}
