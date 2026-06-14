import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/products — query products by various filters
// Query params: categoryId, storeId, limit, excludeProductId, featured
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)

    const storeId = searchParams.get('storeId') || STORE_ID
    const categoryId = searchParams.get('categoryId')
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const excludeProductId = searchParams.get('excludeProductId')
    const featured = searchParams.get('featured')

    // Build where clause
    const where: Record<string, unknown> = {
      storeId,
      isAvailable: true,
      stockQuantity: { gt: 0 },
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (featured === 'true') {
      where.isFeatured = true
    }

    if (excludeProductId) {
      where.id = { not: excludeProductId }
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
      take: limit,
    })

    // Map to frontend snake_case format
    const mapped = products.map((p: Record<string, unknown>) => ({
      id: p.id,
      store_id: p.storeId,
      category_id: p.categoryId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      original_price: p.originalPrice ?? null,
      vat_rate: p.vatRate,
      is_hfss: p.isHfss,
      image_url: p.imageUrl,
      images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images as string) : p.images) : null,
      barcode: p.barcode,
      brand: p.brand ?? null,
      unit: p.unit,
      weight_kg: p.weightKg ?? null,
      is_available: p.isAvailable,
      stock_quantity: p.stockQuantity,
      is_featured: p.isFeatured,
      rating: p.rating ?? 0,
      review_count: p.reviewCount ?? 0,
      sort_order: p.sortOrder,
      created_at: p.createdAt?.toISOString?.() ?? '',
      updated_at: p.updatedAt?.toISOString?.() ?? '',
      category: p.category ? {
        id: (p.category as Record<string, unknown>).id,
        store_id: (p.category as Record<string, unknown>).storeId,
        name: (p.category as Record<string, unknown>).name,
        slug: (p.category as Record<string, unknown>).slug,
        description: (p.category as Record<string, unknown>).description,
        image_url: (p.category as Record<string, unknown>).imageUrl,
        parent_id: (p.category as Record<string, unknown>).parentId,
        sort_order: (p.category as Record<string, unknown>).sortOrder,
        is_active: (p.category as Record<string, unknown>).isActive,
        created_at: (p.category as Record<string, unknown>).createdAt?.toISOString?.() ?? '',
      } : null,
    }))

    return NextResponse.json({ products: mapped })
  } catch (err) {
    console.error('[Products GET]', err)
    return NextResponse.json({ products: [], error: 'Failed to fetch products' }, { status: 500 })
  }
}
