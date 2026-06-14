import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/bank-holidays — List all bank holidays for the store
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const holidays = await prisma.bankHoliday.findMany({
      where: { storeId: STORE_ID },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json({
      holidays: holidays.map((h) => ({
        id: h.id,
        name: h.name,
        date: h.date.toISOString().split('T')[0],
        mode: h.mode,
        createdAt: h.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[Bank Holidays GET]', err)
    return NextResponse.json({ error: 'Failed to fetch bank holidays' }, { status: 500 })
  }
}

// POST /api/admin/bank-holidays — Add one or more bank holidays
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { holidays } = body as {
      holidays?: Array<{ name: string; date: string; mode: string }>
    }

    // Single holiday add
    if (!holidays) {
      const { name, date, mode } = body as { name?: string; date?: string; mode?: string }
      if (!name || !date) {
        return NextResponse.json({ error: 'Name and date are required' }, { status: 400 })
      }

      const holiday = await prisma.bankHoliday.create({
        data: {
          storeId: STORE_ID,
          name,
          date: new Date(date),
          mode: mode || 'auto_close',
        },
      })

      return NextResponse.json({
        holiday: {
          id: holiday.id,
          name: holiday.name,
          date: holiday.date.toISOString().split('T')[0],
          mode: holiday.mode,
        },
      }, { status: 201 })
    }

    // Bulk add
    if (!Array.isArray(holidays) || holidays.length === 0) {
      return NextResponse.json({ error: 'Holidays array is required' }, { status: 400 })
    }

    // Validate and deduplicate against existing
    const existing = await prisma.bankHoliday.findMany({
      where: { storeId: STORE_ID },
      select: { date: true },
    })
    const existingDates = new Set(existing.map((e) => e.date.toISOString().split('T')[0]))

    const toCreate = holidays.filter(
      (h) => h.name && h.date && !existingDates.has(new Date(h.date).toISOString().split('T')[0])
    )

    const created = await prisma.$transaction(
      toCreate.map((h) =>
        prisma.bankHoliday.create({
          data: {
            storeId: STORE_ID,
            name: h.name,
            date: new Date(h.date),
            mode: h.mode || 'auto_close',
          },
        })
      )
    )

    return NextResponse.json({
      added: created.length,
      skipped: holidays.length - toCreate.length,
      holidays: created.map((h) => ({
        id: h.id,
        name: h.name,
        date: h.date.toISOString().split('T')[0],
        mode: h.mode,
      })),
    }, { status: 201 })
  } catch (err) {
    console.error('[Bank Holidays POST]', err)
    return NextResponse.json({ error: 'Failed to create bank holidays' }, { status: 500 })
  }
}
