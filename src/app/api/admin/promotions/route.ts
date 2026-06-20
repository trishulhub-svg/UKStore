import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/promotions
export async function GET() {
  const { error } = await requireAdmin({ feature: 'promotions' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const promotions = await prisma.promotion.findMany({
      where: { storeId: STORE_ID },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ promotions })
  } catch (err) {
    console.error('[Admin Promotions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch promotions' }, { status: 500 })
  }
}

// POST /api/admin/promotions
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin({ feature: 'promotions' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()

    const promotion = await prisma.promotion.create({
      data: {
        storeId: STORE_ID,
        name: body.name,
        description: body.description || null,
        discountType: body.discountType,
        discountValue: parseFloat(body.discountValue),
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        minimumOrderValue: body.minimumOrderValue ? parseFloat(body.minimumOrderValue) : 0,
        usageLimit: body.usageLimit ? parseInt(body.usageLimit) : null,
        appliesToCategoryIds: body.appliesToCategoryIds || null,
        excludesHfss: body.excludesHfss || false,
        isActive: body.isActive !== false,
        code: body.code || null,
      },
    })

    return NextResponse.json({ promotion }, { status: 201 })
  } catch (err) {
    console.error('[Admin Promotions POST]', err)
    return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 })
  }
}
