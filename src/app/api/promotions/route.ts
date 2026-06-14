import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/promotions — public endpoint for active promotions
// Query params: categoryId (optional, filter by category)
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    const now = new Date()

    const promotions = await prisma.promotion.findMany({
      where: {
        storeId: STORE_ID,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter by category if specified
    let filtered = promotions
    if (categoryId) {
      filtered = promotions.filter((p: Record<string, unknown>) => {
        const categoryIds = p.appliesToCategoryIds
          ? (typeof p.appliesToCategoryIds === 'string'
              ? JSON.parse(p.appliesToCategoryIds as string)
              : p.appliesToCategoryIds)
          : []
        // If no category IDs specified, promotion applies to all
        if (!categoryIds || categoryIds.length === 0) return true
        return (categoryIds as string[]).includes(categoryId)
      })
    }

    const mapped = filtered.map((p: Record<string, unknown>) => ({
      id: p.id,
      store_id: p.storeId,
      name: p.name,
      description: p.description,
      discount_type: p.discountType,
      discount_value: p.discountValue,
      start_date: p.startDate?.toISOString?.() ?? '',
      end_date: p.endDate?.toISOString?.() ?? '',
      applies_to_category_ids: p.appliesToCategoryIds
        ? (typeof p.appliesToCategoryIds === 'string'
            ? JSON.parse(p.appliesToCategoryIds as string)
            : p.appliesToCategoryIds)
        : null,
      excludes_hfss: p.excludesHfss,
      is_active: p.isActive,
      code: p.code ?? null,
    }))

    return NextResponse.json({ promotions: mapped })
  } catch (err) {
    console.error('[Promotions GET]', err)
    return NextResponse.json({ promotions: [] }, { status: 500 })
  }
}
