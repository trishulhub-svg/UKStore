import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

const orderDetailSelect = '*, customer:profiles!orders_customer_id_fkey(id, full_name, phone, email), driver:profiles!orders_driver_id_fkey(id, full_name), address:addresses(*), items:order_items(*, product:products(id, name, image_url, barcode, category:categories(name)))'

// GET /api/driver/orders/[id] — order detail with pick list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (user.role.toLowerCase() !== 'driver') {
    return NextResponse.json({ error: 'Forbidden — driver role required' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: order, error } = await supabase
      .from('orders')
      .select(orderDetailSelect)
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (error) {
      console.error('[Driver Order GET] fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only allow if assigned to this driver or available (no driver)
    if (order.driver_id && order.driver_id !== user.id) {
      return NextResponse.json({ error: 'Not assigned to you' }, { status: 403 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[Driver Order GET]', err)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

// PATCH /api/driver/orders/[id] — update item picked status, change order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (user.role.toLowerCase() !== 'driver') {
    return NextResponse.json({ error: 'Forbidden — driver role required' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params
    const body = await request.json()
    const { itemId, picked, status, assignToMe } = body

    // Fetch the order first
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Driver Order PATCH] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Assign order to driver
    if (assignToMe && !order.driver_id) {
      const { error: assignError } = await supabase
        .from('orders')
        .update({ driver_id: user.id })
        .eq('id', id)

      if (assignError) {
        console.error('[Driver Order PATCH] assign error:', assignError)
        return NextResponse.json({ error: 'Failed to assign order' }, { status: 500 })
      }
    }

    // Update item picked status
    if (itemId !== undefined) {
      const { error: itemError } = await supabase
        .from('order_items')
        .update({ picked: !!picked })
        .eq('id', itemId)

      if (itemError) {
        console.error('[Driver Order PATCH] item update error:', itemError)
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
      }
    }

    // Update order status
    if (status) {
      const validTransitions: Record<string, string[]> = {
        placed: ['picking'],
        picking: ['ready'],
        ready: ['out_for_delivery'],
        out_for_delivery: ['delivered'],
      }

      const allowed = validTransitions[order.status] || []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${order.status} to ${status}` },
          { status: 400 }
        )
      }

      const { error: statusError } = await supabase
        .from('orders')
        .update({
          status,
          driver_id: order.driver_id || user.id,
        })
        .eq('id', id)

      if (statusError) {
        console.error('[Driver Order PATCH] status update error:', statusError)
        return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
      }
    }

    // Return updated order
    const { data: updatedOrder, error: refreshError } = await supabase
      .from('orders')
      .select('*, customer:profiles!orders_customer_id_fkey(id, full_name, phone), address:addresses(*), items:order_items(*, product:products(id, name, image_url, barcode, category:categories(name)))')
      .eq('id', id)
      .maybeSingle()

    if (refreshError) {
      console.error('[Driver Order PATCH] refresh error:', refreshError)
      return NextResponse.json({ error: 'Failed to fetch updated order' }, { status: 500 })
    }

    return NextResponse.json({ order: updatedOrder })
  } catch (err) {
    console.error('[Driver Order PATCH]', err)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
