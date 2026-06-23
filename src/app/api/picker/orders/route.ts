import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requirePicker } from '@/lib/feature-permissions'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/picker/orders — get orders that need packing.
// Accessible by pickers with EITHER picker_dashboard (view stats) OR picker_packing (pack orders).
// This way, a picker who only has picker_dashboard can still see the dashboard's stats,
// and a picker with picker_packing can use the packing workflow.
export async function GET(request: NextRequest) {
  const { error, user } = await requirePicker({ anyOf: ['picker_dashboard', 'picker_packing'] })
  if (error) return error

  try {
    const prisma = await getPrisma()

    // Orders that need packing: placed or picking status
    const ordersToPack = await prisma.order.findMany({
      where: {
        storeId: STORE_ID,
        status: { in: ['placed', 'picking'] },
      },
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                aisle: true,
                imageUrl: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Ready orders (packed, waiting for driver)
    const readyOrders = await prisma.order.findMany({
      where: {
        storeId: STORE_ID,
        status: 'ready',
      },
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          select: { id: true },
        },
      },
      orderBy: { packedAt: 'desc' },
      take: 10,
    })

    // Stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const bagsCompletedToday = await prisma.order.count({
      where: {
        storeId: STORE_ID,
        status: { in: ['ready', 'out_for_delivery', 'delivered'] },
        packedAt: { gte: today },
      },
    })

    const formattedOrders = ordersToPack.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
      customerName: o.customer.name,
      items: o.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        picked: item.picked,
        aisle: item.product?.aisle || null,
        product: item.product
          ? {
              name: item.product.name,
              imageUrl: item.product.imageUrl,
              category: item.product.category?.name || null,
            }
          : null,
      })),
    }))

    const formattedReady = readyOrders.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      packedAt: o.packedAt?.toISOString(),
      customerName: o.customer.name,
      itemCount: o.items.length,
    }))

    return NextResponse.json({
      orders: formattedOrders,
      readyOrders: formattedReady,
      stats: {
        bagsCompletedToday,
        ordersToPack: formattedOrders.length,
      },
    })
  } catch (err) {
    console.error('[Picker Orders GET]', err)
    return NextResponse.json({ error: 'Failed to fetch picker orders' }, { status: 500 })
  }
}
