import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireDriver } from '@/lib/feature-permissions'

const STORE_ID = 'store-fresh-mart-001'

// POST /api/driver/orders/[id]/deliver — Confirm delivery with photo/signature proof
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireDriver({ feature: 'driver_dashboard' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()
    const { deliveryPhotoUrl, signatureUrl } = body as {
      deliveryPhotoUrl?: string
      signatureUrl?: string
    }

    const order = await prisma.order.findFirst({
      where: { id, storeId: STORE_ID },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'out_for_delivery') {
      return NextResponse.json(
        { error: 'Order must be out for delivery to confirm delivery' },
        { status: 400 }
      )
    }

    // Check Challenge 25 if required
    if (order.hasChallenge25 && !order.challenge25Verified) {
      return NextResponse.json(
        { error: 'Cannot confirm delivery: Challenge 25 age verification required first' },
        { status: 400 }
      )
    }

    // Update order to delivered with proof
    const updateData: any = {
      status: 'delivered',
      deliveredAt: new Date(),
      driverId: order.driverId || user.id,
    }

    if (deliveryPhotoUrl) {
      updateData.deliveryPhotoUrl = deliveryPhotoUrl
    }

    if (signatureUrl) {
      // Store signature in the notes field as a data URL prefix for identification
      // or use a separate field if available. For now we store alongside photo
      updateData.deliveryPhotoUrl = deliveryPhotoUrl
        ? `${deliveryPhotoUrl}|||SIG:${signatureUrl}`
        : `SIG:${signatureUrl}`
    }

    await prisma.order.update({
      where: { id },
      data: updateData,
    })

    // Return updated order
    const updatedOrder = await prisma.order.findFirst({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        address: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                barcode: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ order: updatedOrder })
  } catch (err) {
    console.error('[Driver Order Deliver POST]', err)
    return NextResponse.json({ error: 'Failed to confirm delivery' }, { status: 500 })
  }
}
