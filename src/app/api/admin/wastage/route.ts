import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/wastage — list wastage logs with filters
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const reason = searchParams.get('reason')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (reason) where.reason = reason
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Filter to products in this store
    where.product = { storeId: STORE_ID }

    const [logs, total] = await Promise.all([
      prisma.wastageLog.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, price: true, category: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wastageLog.count({ where }),
    ])

    // Calculate summary stats
    const allLogs = await prisma.wastageLog.findMany({
      where: { product: { storeId: STORE_ID } },
      include: { product: { select: { price: true } } },
    })

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const weeklyLogs = allLogs.filter((l) => l.createdAt >= weekAgo)
    const monthlyLogs = allLogs.filter((l) => l.createdAt >= monthAgo)

    const weeklyCost = weeklyLogs.reduce((sum, l) => sum + (l.product?.price ?? 0) * l.quantity, 0)
    const monthlyCost = monthlyLogs.reduce((sum, l) => sum + (l.product?.price ?? 0) * l.quantity, 0)

    const logsResponse = logs.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product?.name ?? 'Unknown',
      productPrice: l.product?.price ?? 0,
      category: l.product?.category?.name ?? '',
      quantity: l.quantity,
      reason: l.reason,
      notes: l.notes,
      loggedBy: l.loggedBy,
      createdAt: l.createdAt.toISOString(),
    }))

    return NextResponse.json({
      logs: logsResponse,
      total,
      page,
      limit,
      summary: {
        weeklyCost: Math.round(weeklyCost * 100) / 100,
        monthlyCost: Math.round(monthlyCost * 100) / 100,
        weeklyCount: weeklyLogs.length,
        monthlyCount: monthlyLogs.length,
      },
    })
  } catch (err) {
    console.error('[Wastage GET]', err)
    return NextResponse.json({ error: 'Failed to fetch wastage logs' }, { status: 500 })
  }
}

// POST /api/admin/wastage — create a new wastage log
export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()

    const { productId, quantity, reason, notes } = body

    if (!productId || !quantity || !reason) {
      return NextResponse.json(
        { error: 'Product, quantity, and reason are required' },
        { status: 400 }
      )
    }

    const qty = parseInt(quantity)
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 })
    }

    // Verify product exists and belongs to store
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: STORE_ID },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Create wastage log and decrement stock in a transaction
    const [wastageLog] = await prisma.$transaction([
      prisma.wastageLog.create({
        data: {
          productId,
          quantity: qty,
          reason,
          notes: notes || null,
          loggedBy: user!.id,
        },
        include: {
          product: { select: { name: true, price: true } },
        },
      }),
      prisma.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: qty } },
      }),
    ])

    return NextResponse.json({
      log: {
        id: wastageLog.id,
        productId: wastageLog.productId,
        productName: wastageLog.product?.name ?? 'Unknown',
        productPrice: wastageLog.product?.price ?? 0,
        quantity: wastageLog.quantity,
        reason: wastageLog.reason,
        notes: wastageLog.notes,
        loggedBy: wastageLog.loggedBy,
        createdAt: wastageLog.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[Wastage POST]', err)
    return NextResponse.json({ error: 'Failed to create wastage log' }, { status: 500 })
  }
}
