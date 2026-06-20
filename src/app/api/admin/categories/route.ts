import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/categories
export async function GET() {
  const { error } = await requireAdmin({ feature: 'categories' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const categories = await prisma.category.findMany({
      where: { storeId: STORE_ID },
      include: {
        _count: { select: { products: true } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ categories })
  } catch (err) {
    console.error('[Admin Categories GET]', err)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST /api/admin/categories
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin({ feature: 'categories' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()

    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const category = await prisma.category.create({
      data: {
        storeId: STORE_ID,
        name: body.name,
        slug,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        parentId: body.parentId || null,
        sortOrder: parseInt(body.sortOrder || '0'),
        isActive: body.isActive !== false,
      },
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (err: any) {
    console.error('[Admin Categories POST]', err)
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'A category with this slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
