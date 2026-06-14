import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/promotions/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const promotion = await prisma.promotion.findFirst({
      where: { id, storeId: STORE_ID },
    })

    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    return NextResponse.json({ promotion })
  } catch (err) {
    console.error('[Admin Promotion GET]', err)
    return NextResponse.json({ error: 'Failed to fetch promotion' }, { status: 500 })
  }
}

// PATCH /api/admin/promotions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.promotion.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description || null
    if (body.discountType !== undefined) data.discountType = body.discountType
    if (body.discountValue !== undefined) data.discountValue = parseFloat(body.discountValue)
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate)
    if (body.appliesToCategoryIds !== undefined) data.appliesToCategoryIds = body.appliesToCategoryIds || null
    if (body.excludesHfss !== undefined) data.excludesHfss = body.excludesHfss
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.code !== undefined) data.code = body.code || null

    const promotion = await prisma.promotion.update({
      where: { id },
      data,
    })

    return NextResponse.json({ promotion })
  } catch (err) {
    console.error('[Admin Promotion PATCH]', err)
    return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 })
  }
}

// DELETE /api/admin/promotions/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const existing = await prisma.promotion.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    await prisma.promotion.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Promotion DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete promotion' }, { status: 500 })
  }
}
