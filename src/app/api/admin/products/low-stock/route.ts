import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/products/low-stock — products where stockQuantity <= minStockThreshold
export async function GET() {
  const { error } = await requireAdmin({ feature: 'products' })
  if (error) return error

  try {
    const prisma = await getPrisma()

    const allProducts = await prisma.product.findMany({
      where: { storeId: STORE_ID },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { stockQuantity: 'asc' },
    })

    // SQLite doesn't support cross-column comparison in WHERE, filter in JS
    const lowStockProducts = allProducts.filter(
      (p) => p.stockQuantity <= p.minStockThreshold
    )

    return NextResponse.json({
      products: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        stockQuantity: p.stockQuantity,
        minStockThreshold: p.minStockThreshold,
        category: p.category,
        isAvailable: p.isAvailable,
        price: p.price,
        imageUrl: p.imageUrl,
      })),
      count: lowStockProducts.length,
    })
  } catch (err) {
    console.error('[Low Stock GET]', err)
    return NextResponse.json({ error: 'Failed to fetch low-stock products' }, { status: 500 })
  }
}
