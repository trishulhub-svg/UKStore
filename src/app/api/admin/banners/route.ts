import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/banners — list all banners
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const banners = await prisma.banner.findMany({
      where: { storeId: STORE_ID },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ banners })
  } catch (err) {
    console.error('[Admin Banners GET]', err)
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 })
  }
}

// POST /api/admin/banners — create a banner
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()

    const banner = await prisma.banner.create({
      data: {
        storeId: STORE_ID,
        title: body.title || null,
        imageUrl: body.imageUrl,
        linkUrl: body.linkUrl || null,
        linkCategory: body.linkCategory || null,
        sortOrder: body.sortOrder || 0,
        isActive: body.isActive !== false,
      },
    })

    return NextResponse.json({ banner }, { status: 201 })
  } catch (err) {
    console.error('[Admin Banners POST]', err)
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}
