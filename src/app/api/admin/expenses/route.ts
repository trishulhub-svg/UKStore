import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// GET /api/admin/expenses
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { storeId: STORE_ID }
    if (category) where.category = category

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
    })

    const total = await prisma.expense.count({ where })

    return NextResponse.json({ expenses, total })
  } catch (err) {
    console.error('[Expenses GET]', err)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

// POST /api/admin/expenses
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { category, description, amount, date } = body

    if (!category || !description || !amount || !date) {
      return NextResponse.json({ error: 'category, description, amount, and date are required' }, { status: 400 })
    }

    const validCategories = ['electricity', 'rent', 'packaging', 'fuel', 'other']
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category. Must be one of: ' + validCategories.join(', ') }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        storeId: STORE_ID,
        category,
        description,
        amount,
        date: new Date(date),
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (err) {
    console.error('[Expenses POST]', err)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
