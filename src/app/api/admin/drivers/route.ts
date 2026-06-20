import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/drivers — list drivers
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin({ feature: 'drivers' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const where: any = { role: 'DRIVER' }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const drivers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        driverProfile: true,
        drivenOrders: {
          select: { id: true, status: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { drivenOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ drivers })
  } catch (err) {
    console.error('[Admin Drivers GET]', err)
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 })
  }
}

// PATCH /api/admin/drivers — approve/reject/toggle driver
export async function PATCH(request: NextRequest) {
  const { error, user: adminUser } = await requireAdmin({ feature: 'drivers' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { driverId, verificationStatus, rejectionReason, isActive } = body

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 })
    }

    const driver = await prisma.user.findFirst({
      where: { id: driverId, role: 'DRIVER' },
      include: { driverProfile: true },
    })
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    // Update driver profile verification
    if (verificationStatus && driver.driverProfile) {
      await prisma.driverProfile.update({
        where: { userId: driverId },
        data: {
          verificationStatus,
          verifiedBy: adminUser!.id,
          verifiedAt: new Date(),
          rejectionReason: verificationStatus === 'rejected' ? (rejectionReason || null) : null,
        },
      })
    }

    // Toggle active
    if (isActive !== undefined) {
      await prisma.user.update({
        where: { id: driverId },
        data: { isActive },
      })
    }

    const updated = await prisma.user.findFirst({
      where: { id: driverId },
      select: {
        id: true, name: true, email: true, phone: true, isActive: true,
        driverProfile: true,
        _count: { select: { drivenOrders: true } },
      },
    })

    return NextResponse.json({ driver: updated })
  } catch (err) {
    console.error('[Admin Drivers PATCH]', err)
    return NextResponse.json({ error: 'Failed to update driver' }, { status: 500 })
  }
}
