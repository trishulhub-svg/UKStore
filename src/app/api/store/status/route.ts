import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/store/status — Public endpoint (no auth required)
export async function GET() {
  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({
      where: { id: STORE_ID },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Check if today is a bank holiday
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const bankHoliday = await prisma.bankHoliday.findFirst({
      where: {
        storeId: STORE_ID,
        date: { gte: today, lt: tomorrow },
      },
    })

    let effectiveIsOpen = store.isOpen
    let bankHolidayMode: string | null = null

    if (bankHoliday) {
      bankHolidayMode = bankHoliday.mode
      if (bankHoliday.mode === 'auto_close') {
        effectiveIsOpen = false
      }
      // reduced_hours and normal: keep store.isOpen as-is
    }

    return NextResponse.json({
      isOpen: effectiveIsOpen,
      openingHours: store.openingHours ? JSON.parse(store.openingHours) : null,
      name: store.name,
      bankHolidayMode,
      bankHolidayName: bankHoliday?.name || null,
      delivery: {
        baseDeliveryFee: store.baseDeliveryFee,
        perKmCharge: store.perKmCharge,
        freeDeliveryThreshold: store.freeDeliveryThreshold,
        deliveryRadiusKm: store.deliveryRadiusKm,
      },
    })
  } catch (err) {
    console.error('[Public Store Status GET]', err)
    return NextResponse.json({ error: 'Failed to fetch store status' }, { status: 500 })
  }
}
