import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/store/status
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({
      where: { id: STORE_ID },
      select: {
        isOpen: true,
        openingHours: true,
        baseDeliveryFee: true,
        perKmCharge: true,
        freeDeliveryThreshold: true,
        deliveryRadiusKm: true,
        notificationTemplate: true,
      },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    return NextResponse.json({
      isOpen: store.isOpen,
      openingHours: store.openingHours ? JSON.parse(store.openingHours) : null,
      notificationTemplate: store.notificationTemplate ? JSON.parse(store.notificationTemplate) : null,
      delivery: {
        baseDeliveryFee: store.baseDeliveryFee,
        perKmCharge: store.perKmCharge,
        freeDeliveryThreshold: store.freeDeliveryThreshold,
        deliveryRadiusKm: store.deliveryRadiusKm,
      },
    })
  } catch (err) {
    console.error('[Admin Store Status GET]', err)
    return NextResponse.json({ error: 'Failed to fetch store status' }, { status: 500 })
  }
}

// PUT /api/admin/store/status
export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { isOpen, openingHours, delivery, notificationTemplate } = body

    const data: any = {}

    if (typeof isOpen === 'boolean') {
      data.isOpen = isOpen
    }

    if (openingHours !== undefined) {
      data.openingHours = JSON.stringify(openingHours)
    }

    if (notificationTemplate !== undefined) {
      data.notificationTemplate = JSON.stringify(notificationTemplate)
    }

    if (delivery) {
      if (typeof delivery.baseDeliveryFee === 'number') data.baseDeliveryFee = delivery.baseDeliveryFee
      if (typeof delivery.perKmCharge === 'number') data.perKmCharge = delivery.perKmCharge
      if (typeof delivery.freeDeliveryThreshold === 'number') data.freeDeliveryThreshold = delivery.freeDeliveryThreshold
      if (typeof delivery.deliveryRadiusKm === 'number') data.deliveryRadiusKm = delivery.deliveryRadiusKm
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const store = await prisma.store.update({
      where: { id: STORE_ID },
      data,
      select: {
        isOpen: true,
        openingHours: true,
        baseDeliveryFee: true,
        perKmCharge: true,
        freeDeliveryThreshold: true,
        deliveryRadiusKm: true,
        notificationTemplate: true,
      },
    })

    return NextResponse.json({
      isOpen: store.isOpen,
      openingHours: store.openingHours ? JSON.parse(store.openingHours) : null,
      notificationTemplate: store.notificationTemplate ? JSON.parse(store.notificationTemplate) : null,
      delivery: {
        baseDeliveryFee: store.baseDeliveryFee,
        perKmCharge: store.perKmCharge,
        freeDeliveryThreshold: store.freeDeliveryThreshold,
        deliveryRadiusKm: store.deliveryRadiusKm,
      },
    })
  } catch (err) {
    console.error('[Admin Store Status PUT]', err)
    return NextResponse.json({ error: 'Failed to update store status' }, { status: 500 })
  }
}
