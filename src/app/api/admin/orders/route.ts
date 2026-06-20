import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/orders — list orders with filters
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin({ feature: 'orders' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const paymentMethod = searchParams.get('paymentMethod')
    const bankTransferVerified = searchParams.get('bankTransferVerified')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { storeId: STORE_ID }
    if (status) where.status = status
    if (paymentMethod) where.paymentMethod = paymentMethod
    if (bankTransferVerified !== null) where.bankTransferVerified = bankTransferVerified === 'true'
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { customer: { email: { contains: search } } },
        { customer: { name: { contains: search } } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          driver: { select: { id: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({ orders, total, page, limit })
  } catch (err) {
    console.error('[Admin Orders GET]', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// PATCH /api/admin/orders — update order status
export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin({ feature: 'orders' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { orderId, status, driverId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const existing = await prisma.order.findFirst({ where: { id: orderId, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const data: any = {}
    if (status) data.status = status
    if (driverId !== undefined) data.driverId = driverId || null
    if (body.bankTransferVerified !== undefined) data.bankTransferVerified = body.bankTransferVerified

    const order = await prisma.order.update({
      where: { id: orderId },
      data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        driver: { select: { id: true, name: true } },
        items: true,
      },
    })

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[Admin Orders PATCH]', err)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
