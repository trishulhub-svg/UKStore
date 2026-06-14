import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/customers/[id] — customer detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const customer = await prisma.user.findFirst({
      where: { id, role: 'CUSTOMER' },
      include: {
        addresses: true,
        orders: {
          include: {
            items: { select: { productName: true, quantity: true, unitPrice: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const totalSpent = customer.orders.reduce((sum, o) => sum + o.total, 0)

    return NextResponse.json({ customer: { ...customer, totalSpent } })
  } catch (err) {
    console.error('[Admin Customer GET]', err)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}
