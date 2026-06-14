import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/customers — list customers
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { role: 'CUSTOMER' }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        orders: {
          select: { id: true, total: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const total = await prisma.user.count({ where })

    // Compute aggregated stats for each customer
    const enriched = customers.map((c) => {
      const orderCount = c.orders.length
      const totalSpent = c.orders.reduce((sum: number, o: any) => sum + o.total, 0)
      return { ...c, orderCount, totalSpent }
    })

    return NextResponse.json({ customers: enriched, total, page, limit })
  } catch (err) {
    console.error('[Admin Customers GET]', err)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}
