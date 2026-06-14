import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/products/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const product = await prisma.product.findFirst({
      where: { id, storeId: STORE_ID },
      include: { category: { select: { id: true, name: true } } },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (err) {
    console.error('[Admin Product GET]', err)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// PATCH /api/admin/products/[id]
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

    const existing = await prisma.product.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const data: any = {}
    if (body.name !== undefined) {
      data.name = body.name
      data.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }
    if (body.categoryId !== undefined) data.categoryId = body.categoryId
    if (body.description !== undefined) data.description = body.description || null
    if (body.price !== undefined) data.price = parseFloat(body.price)
    if (body.vatRate !== undefined) data.vatRate = parseFloat(body.vatRate)
    if (body.isHfss !== undefined) data.isHfss = body.isHfss
    if (body.isAgeRestricted !== undefined) data.isAgeRestricted = body.isAgeRestricted
    if (body.minimumAge !== undefined) data.minimumAge = parseInt(body.minimumAge)
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null
    if (body.barcode !== undefined) data.barcode = body.barcode || null
    if (body.unit !== undefined) data.unit = body.unit
    if (body.weightKg !== undefined) data.weightKg = body.weightKg ? parseFloat(body.weightKg) : null
    if (body.aisle !== undefined) data.aisle = body.aisle || null
    if (body.isAvailable !== undefined) data.isAvailable = body.isAvailable
    if (body.stockQuantity !== undefined) data.stockQuantity = parseInt(body.stockQuantity)
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
    if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder)
    if (body.minStockThreshold !== undefined) data.minStockThreshold = parseInt(body.minStockThreshold)
    if (body.substituteProductId !== undefined) data.substituteProductId = body.substituteProductId || null

    const product = await prisma.product.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ product })
  } catch (err) {
    console.error('[Admin Product PATCH]', err)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// DELETE /api/admin/products/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const existing = await prisma.product.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check for linked order items
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } })
    if (orderItemCount > 0) {
      return NextResponse.json({
        error: `Cannot delete — product is referenced by ${orderItemCount} order item(s)`,
      }, { status: 409 })
    }

    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Product DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
