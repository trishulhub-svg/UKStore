import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

// GET /api/user/favourites — list favourites
export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data: favourites, error } = await supabase
      .from('favourites')
      .select('*, product:products(*, category:categories(name, slug))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[User Favourites GET]', error)
      return NextResponse.json({ error: 'Failed to fetch favourites' }, { status: 500 })
    }

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
    const supabase = getSupabaseAdmin()
    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // Check if already favourited
    const { data: existing, error: findError } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .maybeSingle()

    if (findError) {
      console.error('[User Favourites POST] find error', findError)
      return NextResponse.json({ error: 'Failed to add favourite' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ favourite: existing })
    }

    const { data: favourite, error } = await supabase
      .from('favourites')
      .insert({ user_id: user.id, product_id: productId })
      .select('*, product:products(*)')
      .single()

    if (error) {
      console.error('[User Favourites POST]', error)
      return NextResponse.json({ error: 'Failed to add favourite' }, { status: 500 })
    }

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
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const favouriteId = searchParams.get('favouriteId')

    if (favouriteId) {
      const { error } = await supabase
        .from('favourites')
        .delete()
        .eq('id', favouriteId)
        .eq('user_id', user.id)

      if (error) {
        console.error('[User Favourites DELETE]', error)
        return NextResponse.json({ error: 'Failed to remove favourite' }, { status: 500 })
      }
    } else if (productId) {
      const { error } = await supabase
        .from('favourites')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId)

      if (error) {
        console.error('[User Favourites DELETE]', error)
        return NextResponse.json({ error: 'Failed to remove favourite' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'productId or favouriteId required' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[User Favourites DELETE]', err)
    return NextResponse.json({ error: 'Failed to remove favourite' }, { status: 500 })
  }
}
