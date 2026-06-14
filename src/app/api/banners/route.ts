import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/banners — Public endpoint for active banners
export async function GET() {
  try {
    const prisma = await getPrisma()
    const banners = await prisma.banner.findMany({
      where: {
        storeId: STORE_ID,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    })

    const mapped = banners.map((b) => ({
      id: b.id,
      store_id: b.storeId,
      title: b.title,
      image_url: b.imageUrl,
      link_url: b.linkUrl,
      link_category: b.linkCategory,
      sort_order: b.sortOrder,
      is_active: b.isActive,
      created_at: b.createdAt?.toISOString?.() ?? '',
      updated_at: b.updatedAt?.toISOString?.() ?? '',
    }))

    return NextResponse.json({ banners: mapped })
  } catch (err) {
    console.error('[Banners GET]', err)
    return NextResponse.json({ banners: [] })
  }
}
