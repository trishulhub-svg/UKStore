import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/store/info — Public endpoint for store contact details (no auth required)
// Used by navbar, footer, and other client components to display dynamic store info
export async function GET() {
  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({
      where: { id: STORE_ID },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: store.id,
      name: store.name,
      slug: store.slug,
      address: store.address,
      latitude: store.latitude,
      longitude: store.longitude,
      phone: store.phone,
      email: store.email,
      base_delivery_fee: store.baseDeliveryFee,
      per_km_charge: store.perKmCharge,
      free_delivery_threshold: store.freeDeliveryThreshold,
      delivery_radius_km: store.deliveryRadiusKm,
      is_active: store.isActive,
      is_open: store.isOpen ?? true,
    })
  } catch (err) {
    console.error('[Public Store Info GET]', err)
    return NextResponse.json({ error: 'Failed to fetch store info' }, { status: 500 })
  }
}
