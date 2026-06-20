import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// DELETE /api/admin/expenses/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'finance' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const existing = await prisma.expense.findFirst({
      where: { id, storeId: STORE_ID },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    await prisma.expense.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Expenses DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
