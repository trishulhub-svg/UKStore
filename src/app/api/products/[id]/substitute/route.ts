import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/products/[id]/substitute — get substitute product for a given product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const prisma = await getPrisma()
    const { id } = await params

    const product = await prisma.product.findFirst({
      where: { id, storeId: STORE_ID },
      select: { substituteProductId: true },
    })

    if (!product?.substituteProductId) {
      return NextResponse.json({ substitute: null })
    }

    const substitute = await prisma.product.findFirst({
      where: {
        id: product.substituteProductId,
        storeId: STORE_ID,
        isAvailable: true,
        stockQuantity: { gt: 0 },
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    })

    if (!substitute) {
      return NextResponse.json({ substitute: null })
    }

    return NextResponse.json({
      substitute: {
        id: substitute.id,
        name: substitute.name,
        slug: substitute.slug,
        price: substitute.price,
        imageUrl: substitute.imageUrl,
        stockQuantity: substitute.stockQuantity,
        isAvailable: substitute.isAvailable,
        category: substitute.category,
      },
    })
  } catch (err) {
    console.error('[Product Substitute GET]', err)
    return NextResponse.json({ substitute: null })
  }
}
