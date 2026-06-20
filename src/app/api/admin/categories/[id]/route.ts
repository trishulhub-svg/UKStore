import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/categories/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'categories' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const category = await prisma.category.findFirst({
      where: { id, storeId: STORE_ID },
      include: {
        _count: { select: { products: true } },
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ category })
  } catch (err) {
    console.error('[Admin Category GET]', err)
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 })
  }
}

// PATCH /api/admin/categories/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'categories' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.category.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const data: any = {}
    if (body.name !== undefined) {
      data.name = body.name
      data.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }
    if (body.description !== undefined) data.description = body.description || null
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null
    if (body.parentId !== undefined) data.parentId = body.parentId || null
    if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder)
    if (body.isActive !== undefined) data.isActive = body.isActive

    const category = await prisma.category.update({
      where: { id },
      data,
    })

    return NextResponse.json({ category })
  } catch (err) {
    console.error('[Admin Category PATCH]', err)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE /api/admin/categories/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'categories' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const existing = await prisma.category.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const productCount = await prisma.product.count({ where: { categoryId: id } })
    if (productCount > 0) {
      return NextResponse.json({
        error: `Cannot delete — category has ${productCount} product(s). Move them first.`,
      }, { status: 409 })
    }

    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Category DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
