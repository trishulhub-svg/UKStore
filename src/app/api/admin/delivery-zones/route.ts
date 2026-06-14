import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/delivery-zones
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const zones = await prisma.deliveryZone.findMany({
      where: { storeId: STORE_ID },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ zones })
  } catch (err) {
    console.error('[Admin Delivery Zones GET]', err)
    return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 })
  }
}

// POST /api/admin/delivery-zones
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()

    const zone = await prisma.deliveryZone.create({
      data: {
        storeId: STORE_ID,
        name: body.name,
        postcodes: body.postcodes, // JSON string
        deliveryFee: parseFloat(body.deliveryFee || '0'),
        minimumOrder: parseFloat(body.minimumOrder || '0'),
        isActive: body.isActive !== false,
      },
    })

    return NextResponse.json({ zone }, { status: 201 })
  } catch (err) {
    console.error('[Admin Delivery Zones POST]', err)
    return NextResponse.json({ error: 'Failed to create delivery zone' }, { status: 500 })
  }
}
