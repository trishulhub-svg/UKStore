import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// DELETE /api/admin/shifts/[id] — delete a shift
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const role = user.role.toLowerCase()
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  try {
    const { id } = await params
    const prisma = await getPrisma()

    const shift = await prisma.shift.findUnique({ where: { id } })
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    await prisma.shift.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Shifts DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}
