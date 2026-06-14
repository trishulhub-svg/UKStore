import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'store-fresh-mart-001'

// DELETE /api/admin/bank-holidays/[id] — Remove a bank holiday
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const holiday = await prisma.bankHoliday.findFirst({
      where: { id, storeId: STORE_ID },
    })

    if (!holiday) {
      return NextResponse.json({ error: 'Bank holiday not found' }, { status: 404 })
    }

    await prisma.bankHoliday.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Bank Holiday DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete bank holiday' }, { status: 500 })
  }
}
