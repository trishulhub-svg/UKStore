import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/delivery-zones/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const zone = await prisma.deliveryZone.findFirst({
      where: { id, storeId: STORE_ID },
    })

    if (!zone) {
      return NextResponse.json({ error: 'Delivery zone not found' }, { status: 404 })
    }

    return NextResponse.json({ zone })
  } catch (err) {
    console.error('[Admin Delivery Zone GET]', err)
    return NextResponse.json({ error: 'Failed to fetch delivery zone' }, { status: 500 })
  }
}

// PATCH /api/admin/delivery-zones/[id]
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

    const existing = await prisma.deliveryZone.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Delivery zone not found' }, { status: 404 })
    }

    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.postcodes !== undefined) data.postcodes = body.postcodes
    if (body.deliveryFee !== undefined) data.deliveryFee = parseFloat(body.deliveryFee)
    if (body.minimumOrder !== undefined) data.minimumOrder = parseFloat(body.minimumOrder)
    if (body.isActive !== undefined) data.isActive = body.isActive

    const zone = await prisma.deliveryZone.update({
      where: { id },
      data,
    })

    return NextResponse.json({ zone })
  } catch (err) {
    console.error('[Admin Delivery Zone PATCH]', err)
    return NextResponse.json({ error: 'Failed to update delivery zone' }, { status: 500 })
  }
}

// DELETE /api/admin/delivery-zones/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const existing = await prisma.deliveryZone.findFirst({ where: { id, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Delivery zone not found' }, { status: 404 })
    }

    await prisma.deliveryZone.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Delivery Zone DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete delivery zone' }, { status: 500 })
  }
}
