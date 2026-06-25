import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/delivery-map — Return active orders with addresses and driver locations
export async function GET() {
  const { error } = await requireAdmin({ feature: 'delivery_zones' })
  if (error) return error

  try {
    const prisma = await getPrisma()

    // Get store info for map center
    const store = await prisma.store.findUnique({
      where: { id: STORE_ID },
      select: {
        latitude: true,
        longitude: true,
        deliveryRadiusKm: true,
        name: true,
        address: true,
      },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Get active orders (not delivered/cancelled) with address
    const orders = await prisma.order.findMany({
      where: {
        storeId: STORE_ID,
        status: { in: ['placed', 'picking', 'ready', 'out_for_delivery'] },
      },
      include: {
        customer: { select: { id: true, name: true } },
        address: { select: { id: true, addressLine1: true, postcode: true, latitude: true, longitude: true } },
        driver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get all active drivers (primary DRIVER role OR additionalRoles
    // contains DRIVER — supports dual-role employees like a picker
    // who is also a driver, currently out on a delivery).
    const drivers = await prisma.user.findMany({
      where: {
        isActive: true,
        drivenOrders: {
          some: {
            status: 'out_for_delivery',
            storeId: STORE_ID,
          },
        },
        OR: [
          { role: 'DRIVER' },
          { additionalRoles: { contains: '"DRIVER"' } },
        ],
      },
      select: {
        id: true,
        name: true,
        driverProfile: { select: { vehicleType: true, vehicleReg: true } },
        drivenOrders: {
          where: { status: 'out_for_delivery', storeId: STORE_ID },
          select: { id: true },
          take: 1,
        },
      },
    })

    return NextResponse.json({
      store: {
        latitude: store.latitude,
        longitude: store.longitude,
        deliveryRadiusKm: store.deliveryRadiusKm,
        name: store.name,
        address: store.address,
      },
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        total: o.total,
        customerName: o.customer.name,
        address: o.address,
        driver: o.driver ? { id: o.driver.id, name: o.driver.name } : null,
      })),
      drivers: drivers.map((d) => ({
        id: d.id,
        name: d.name,
        vehicleType: d.driverProfile?.vehicleType || null,
        vehicleReg: d.driverProfile?.vehicleReg || null,
        activeOrderId: d.drivenOrders[0]?.id || null,
        // Driver locations would come from a real-time tracking system
        // For now, return the store location as placeholder
        latitude: store.latitude + (Math.random() - 0.5) * 0.02,
        longitude: store.longitude + (Math.random() - 0.5) * 0.02,
      })),
    })
  } catch (err) {
    console.error('[Delivery Map GET]', err)
    return NextResponse.json({ error: 'Failed to fetch delivery map data' }, { status: 500 })
  }
}
