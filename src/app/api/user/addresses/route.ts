import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// GET /api/user/addresses — list addresses
export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const addresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ addresses })
  } catch (err) {
    console.error('[User Addresses GET]', err)
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 })
  }
}

// POST /api/user/addresses — add address
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { label, addressLine1, addressLine2, city, postcode, latitude, longitude, isDefault } = body

    if (!addressLine1 || !city || !postcode) {
      return NextResponse.json(
        { error: 'Address line 1, city, and postcode are required' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    const address = await prisma.address.create({
      data: {
        userId: user.id,
        label: label || null,
        addressLine1,
        addressLine2: addressLine2 || null,
        city,
        postcode,
        latitude: latitude || null,
        longitude: longitude || null,
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json({ address }, { status: 201 })
  } catch (err) {
    console.error('[User Addresses POST]', err)
    return NextResponse.json({ error: 'Failed to add address' }, { status: 500 })
  }
}

// PATCH /api/user/addresses — update address (bulk)
export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { addressId, label, addressLine1, addressLine2, city, postcode, latitude, longitude, isDefault } = body

    if (!addressId) {
      return NextResponse.json({ error: 'addressId is required' }, { status: 400 })
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    const data: Record<string, unknown> = {}
    if (label !== undefined) data.label = label
    if (addressLine1 !== undefined) data.addressLine1 = addressLine1
    if (addressLine2 !== undefined) data.addressLine2 = addressLine2
    if (city !== undefined) data.city = city
    if (postcode !== undefined) data.postcode = postcode
    if (latitude !== undefined) data.latitude = latitude
    if (longitude !== undefined) data.longitude = longitude
    if (isDefault !== undefined) data.isDefault = isDefault

    const address = await prisma.address.update({
      where: { id: addressId },
      data,
    })

    return NextResponse.json({ address })
  } catch (err) {
    console.error('[User Addresses PATCH]', err)
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 })
  }
}

// DELETE /api/user/addresses — delete address
export async function DELETE(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const addressId = searchParams.get('addressId')

    if (!addressId) {
      return NextResponse.json({ error: 'addressId is required' }, { status: 400 })
    }

    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    await prisma.address.delete({ where: { id: addressId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[User Addresses DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 })
  }
}
