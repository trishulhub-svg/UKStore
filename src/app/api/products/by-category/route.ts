import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/products/by-category — Products grouped by category for homepage sliders
export async function GET() {
  try {
    const prisma = await getPrisma()

    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        where: { storeId: STORE_ID, isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.product.findMany({
        where: { storeId: STORE_ID, isAvailable: true },
        include: { category: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ])

    // Group products by category
    const grouped = categories.map((cat) => {
      const catProducts = products
        .filter((p) => p.categoryId === cat.id)
        .slice(0, 10) // Max 10 per category slider
        .map((p) => ({
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
          is_age_restricted: p.isAgeRestricted ?? false,
          minimum_age: p.minimumAge ?? 0,
          image_url: p.imageUrl,
          images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : null,
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
          category: {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
          },
        }))

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        image_url: cat.imageUrl,
        sort_order: cat.sortOrder,
        products: catProducts,
      }
    })

    // Only return categories that have products
    const withProducts = grouped.filter((g) => g.products.length > 0)

    return NextResponse.json({ categories: withProducts })
  } catch (err) {
    console.error('[Products By Category GET]', err)
    return NextResponse.json({ categories: [] })
  }
}
