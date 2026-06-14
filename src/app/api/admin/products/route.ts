import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/products — list products with filters
export async function GET(request: NextRequest) {
  const { error, user } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { storeId: STORE_ID }
    if (category) where.categoryId = category
    if (search) where.name = { contains: search }

    const orderBy: any = {}
    if (sortBy === 'price') orderBy.price = sortOrder
    else if (sortBy === 'stock') orderBy.stockQuantity = sortOrder
    else orderBy.name = sortOrder

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({ products, total, page, limit })
  } catch (err) {
    console.error('[Admin Products GET]', err)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

// POST /api/admin/products — create a product
export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()

    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const product = await prisma.product.create({
      data: {
        storeId: STORE_ID,
        categoryId: body.categoryId,
        name: body.name,
        slug,
        description: body.description || null,
        price: parseFloat(body.price),
        vatRate: parseFloat(body.vatRate || '0'),
        isHfss: body.isHfss || false,
        isAgeRestricted: body.isAgeRestricted || false,
        minimumAge: parseInt(body.minimumAge || '0'),
        imageUrl: body.imageUrl || null,
        barcode: body.barcode || null,
        unit: body.unit || 'each',
        weightKg: body.weightKg ? parseFloat(body.weightKg) : null,
        aisle: body.aisle || null,
        minStockThreshold: parseInt(body.minStockThreshold || '5'),
        substituteProductId: body.substituteProductId || null,
        isAvailable: body.isAvailable !== false,
        stockQuantity: parseInt(body.stockQuantity || '0'),
        isFeatured: body.isFeatured || false,
        sortOrder: parseInt(body.sortOrder || '0'),
      },
      include: { category: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (err: any) {
    console.error('[Admin Products POST]', err)
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'A product with this slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
