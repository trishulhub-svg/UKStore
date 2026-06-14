import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/user/orders/[id] — order detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(id, name, image_url, slug, price, category:categories(name))), driver:profiles!driver_id(id, full_name, driver_profiles(vehicle_type, vehicle_reg)), address:addresses(*), store:stores(name)')
      .eq('id', id)
      .eq('customer_id', user.id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (error) {
      console.error('[User Order GET]', error)
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[User Order GET]', err)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
