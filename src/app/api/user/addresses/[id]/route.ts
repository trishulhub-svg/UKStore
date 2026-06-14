import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// PATCH /api/user/addresses/[id] — update single address
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.address.findFirst({
      where: { id, userId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const { label, addressLine1, addressLine2, city, postcode, latitude, longitude, isDefault } = body

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
      where: { id },
      data,
    })

    return NextResponse.json({ address })
  } catch (err) {
    console.error('[User Address PATCH]', err)
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 })
  }
}

// DELETE /api/user/addresses/[id] — delete address
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { id } = await params

    const existing = await prisma.address.findFirst({
      where: { id, userId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    await prisma.address.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[User Address DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 })
  }
}
