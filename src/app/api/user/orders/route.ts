import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/user/orders — list customer orders
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Build query for orders with related data
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(name, image_url)), driver:profiles!driver_id(id, full_name), address:addresses(address_line_1, postcode)', { count: 'exact' })
      .eq('customer_id', user.id)
      .eq('store_id', STORE_ID)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, count: total, error } = await query

    if (error) {
      console.error('[User Orders GET]', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ orders, total: total ?? 0, page, limit })
  } catch (err) {
    console.error('[User Orders GET]', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
