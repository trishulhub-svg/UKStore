import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// GET /api/user/favourites — list favourites
export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const favourites = await prisma.favourite.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            category: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ favourites })
  } catch (err) {
    console.error('[User Favourites GET]', err)
    return NextResponse.json({ error: 'Failed to fetch favourites' }, { status: 500 })
  }
}

// POST /api/user/favourites — add favourite
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // Check if already favourited
    const existing = await prisma.favourite.findUnique({
      where: { userId_productId: { userId: user.id, productId } },
    })

    if (existing) {
      return NextResponse.json({ favourite: existing })
    }

    const favourite = await prisma.favourite.create({
      data: { userId: user.id, productId },
      include: { product: true },
    })

    return NextResponse.json({ favourite }, { status: 201 })
  } catch (err) {
    console.error('[User Favourites POST]', err)
    return NextResponse.json({ error: 'Failed to add favourite' }, { status: 500 })
  }
}

// DELETE /api/user/favourites — remove favourite
export async function DELETE(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const favouriteId = searchParams.get('favouriteId')

    if (favouriteId) {
      await prisma.favourite.delete({
        where: { id: favouriteId, userId: user.id },
      })
    } else if (productId) {
      await prisma.favourite.deleteMany({
        where: { userId: user.id, productId },
      })
    } else {
      return NextResponse.json({ error: 'productId or favouriteId required' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[User Favourites DELETE]', err)
    return NextResponse.json({ error: 'Failed to remove favourite' }, { status: 500 })
  }
}
