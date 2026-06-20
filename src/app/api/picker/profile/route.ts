import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requirePicker } from '@/lib/feature-permissions'

// GET /api/picker/profile — get picker profile
export async function GET() {
  const { error, user } = await requirePicker({ feature: 'picker_profile' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        ...dbUser,
        createdAt: dbUser.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[Picker Profile GET]', err)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

// PATCH /api/picker/profile — update picker profile (phone number)
export async function PATCH(request: NextRequest) {
  const { error, user } = await requirePicker({ feature: 'picker_profile' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { phone } = body

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { phone: phone || null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      user: {
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[Picker Profile PATCH]', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
