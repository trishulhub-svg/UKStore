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

    // A "driver" is anyone whose primary role is DRIVER OR whose
    // additionalRoles JSON contains "DRIVER". The column stores JSON
    // like '["DRIVER","PICKER"]', so a `contains` substring match is
    // safe under SQLite/libSQL. This catches dual-role employees
    // (e.g. primary PICKER + additional DRIVER) who were previously
    // excluded from the driver dropdown.
    const roleCondition = {
      OR: [
        { role: 'DRIVER' },
        { additionalRoles: { contains: '"DRIVER"' } },
      ],
    }
    const where: any = search
      ? {
          AND: [
            roleCondition,
            {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
              ],
            },
          ],
        }
      : roleCondition

    const drivers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        role: true,
        additionalRoles: true,
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

    // Match dual-role employees (primary role might be PICKER but they
    // have DRIVER in additionalRoles). Same OR condition as the GET
    // list above — otherwise the admin could see the driver in the
    // list but couldn't PATCH them.
    const driver = await prisma.user.findFirst({
      where: {
        id: driverId,
        OR: [
          { role: 'DRIVER' },
          { additionalRoles: { contains: '"DRIVER"' } },
        ],
      },
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
