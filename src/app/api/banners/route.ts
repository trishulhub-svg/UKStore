import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/banners — Public endpoint for active banners
// Falls back to the store's two default banner images when no promotional/normal
// banners are uploaded. Returns both the active banners and the default banners
// so the client can decide what to render.
export async function GET() {
  try {
    const prisma = await getPrisma()
    const [banners, store] = await Promise.all([
      prisma.banner.findMany({
        where: {
          storeId: STORE_ID,
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.store.findUnique({
        where: { id: STORE_ID },
        select: { defaultBanner1Url: true, defaultBanner2Url: true, name: true },
      }),
    ])

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

    // Default banners — used by the carousel when no promotional/normal banners exist.
    // Filter out nulls so the client can simply check length.
    const defaultBanners: Array<{ image_url: string; title: string | null; is_default: true }> = []
    if (store?.defaultBanner1Url) {
      defaultBanners.push({ image_url: store.defaultBanner1Url, title: null, is_default: true })
    }
    if (store?.defaultBanner2Url) {
      defaultBanners.push({ image_url: store.defaultBanner2Url, title: null, is_default: true })
    }

    return NextResponse.json({ banners: mapped, defaultBanners })
  } catch (err) {
    console.error('[Banners GET]', err)
    return NextResponse.json({ banners: [], defaultBanners: [] })
  }
}
