import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/categories — public list of active categories
export async function GET() {
  try {
    const prisma = await getPrisma()
    const categories = await prisma.category.findMany({
      where: { storeId: STORE_ID, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        parentId: true,
        sortOrder: true,
      },
    })

    return NextResponse.json({ categories })
  } catch (err) {
    console.error('[Categories GET]', err)
    return NextResponse.json({ categories: [] }, { status: 200 })
  }
}
