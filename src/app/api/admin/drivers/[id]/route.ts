import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/drivers/[id] — driver detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin({ feature: 'drivers' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    // Match dual-role employees (primary role might not be DRIVER, but
    // they have DRIVER in additionalRoles). Without this OR clause,
    // viewing a dual-role driver's detail page would 404.
    const driver = await prisma.user.findFirst({
      where: {
        id,
        OR: [
          { role: 'DRIVER' },
          { additionalRoles: { contains: '"DRIVER"' } },
        ],
      },
      include: {
        driverProfile: true,
        drivenOrders: {
          select: {
            id: true, status: true, total: true, createdAt: true,
            customer: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    return NextResponse.json({ driver })
  } catch (err) {
    console.error('[Admin Driver GET]', err)
    return NextResponse.json({ error: 'Failed to fetch driver' }, { status: 500 })
  }
}
