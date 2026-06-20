import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireDriver } from '@/lib/feature-permissions'

// GET /api/driver/profile — driver profile
export async function GET() {
  const { error, user } = await requireDriver({ feature: 'driver_profile' })
  if (error) return error

  try {
    const prisma = await getPrisma()

    let profile = await prisma.driverProfile.findUnique({
      where: { userId: user.id },
    })

    // Auto-create profile if it doesn't exist
    if (!profile) {
      profile = await prisma.driverProfile.create({
        data: { userId: user.id },
      })
    }

    return NextResponse.json({
      profile,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: null,
      },
    })
  } catch (err) {
    console.error('[Driver Profile GET]', err)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

// PATCH /api/driver/profile — update vehicle info, upload documents
export async function PATCH(request: NextRequest) {
  const { error, user } = await requireDriver({ feature: 'driver_profile' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { vehicleType, vehicleReg, nationalInsuranceNumber, rightToWorkUrl, drivingLicenseUrl } = body

    const data: Record<string, unknown> = {}
    if (vehicleType !== undefined) data.vehicleType = vehicleType
    if (vehicleReg !== undefined) data.vehicleReg = vehicleReg
    if (nationalInsuranceNumber !== undefined) data.nationalInsuranceNumber = nationalInsuranceNumber
    if (rightToWorkUrl !== undefined) data.rightToWorkUrl = rightToWorkUrl
    if (drivingLicenseUrl !== undefined) data.drivingLicenseUrl = drivingLicenseUrl

    // If documents are being uploaded, reset verification to pending
    if (rightToWorkUrl || drivingLicenseUrl) {
      data.verificationStatus = 'pending'
      data.rejectionReason = null
    }

    const profile = await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        userId: user.id,
        ...data,
      },
    })

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[Driver Profile PATCH]', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
