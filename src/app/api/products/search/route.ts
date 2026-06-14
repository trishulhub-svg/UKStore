import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/products/search?q=... — Public endpoint for predictive search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() ?? ''

    if (!q || q.length < 1) {
      return NextResponse.json({ products: [] })
    }

    const prisma = await getPrisma()
    const products = await prisma.product.findMany({
      where: {
        storeId: STORE_ID,
        isAvailable: true,
        name: { contains: q },
      },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    })

    const mapped = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      original_price: p.originalPrice ?? null,
      image_url: p.imageUrl,
      brand: p.brand ?? null,
      unit: p.unit,
      weight_kg: p.weightKg ?? null,
      rating: p.rating ?? 0,
      review_count: p.reviewCount ?? 0,
      category: p.category
        ? {
            id: p.category.id,
            name: p.category.name,
            slug: p.category.slug,
          }
        : null,
    }))

    return NextResponse.json({ products: mapped })
  } catch (err) {
    console.error('[Products Search GET]', err)
    return NextResponse.json({ products: [] })
  }
}
