import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { mapOrder } from '@/lib/supabase/mappers'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/orders/[id] — order detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: order, error: dbError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:profiles!customer_id(id, full_name, email, phone),
        driver:profiles!driver_id(id, full_name, email, phone),
        address:addresses(*),
        items:order_items(*, product:products(id, name, image_url))
      `)
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (dbError) {
      console.error('[Admin Order GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ order: mapOrder(order) })
  } catch (err) {
    console.error('[Admin Order GET]', err)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
