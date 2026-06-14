import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'store-fresh-mart-001'

// POST /api/user/orders/[id]/reorder — reorder (returns items to add to cart)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const order = await prisma.order.findFirst({
      where: { id, customerId: user.id, storeId: STORE_ID },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                slug: true,
                isAvailable: true,
                stockQuantity: true,
                vatRate: true,
                unit: true,
                category: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Return items that are still available
    const availableItems = order.items
      .filter((item) => item.product.isAvailable && item.product.stockQuantity > 0)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.product.price,
        product: item.product,
      }))

    const unavailableItems = order.items
      .filter((item) => !item.product.isAvailable || item.product.stockQuantity <= 0)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        reason: !item.product.isAvailable ? 'No longer available' : 'Out of stock',
      }))

    return NextResponse.json({
      items: availableItems,
      unavailableItems,
      totalItems: availableItems.length,
      unavailableCount: unavailableItems.length,
    })
  } catch (err) {
    console.error('[User Order Reorder POST]', err)
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
  }
}
