import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// PATCH /api/admin/banners/[id] — update a banner
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'banners' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.banner.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title || null
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl
    if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl || null
    if (body.linkCategory !== undefined) data.linkCategory = body.linkCategory || null
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder
    if (body.isActive !== undefined) data.isActive = body.isActive

    const banner = await prisma.banner.update({
      where: { id },
      data,
    })

    return NextResponse.json({ banner })
  } catch (err) {
    console.error('[Admin Banner PATCH]', err)
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 })
  }
}

// DELETE /api/admin/banners/[id] — delete a banner
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'banners' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const existing = await prisma.banner.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
    }

    await prisma.banner.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Banner DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 })
  }
}
