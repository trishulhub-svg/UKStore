import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// POST /api/driver/orders/[id]/deliver — confirm delivery
export async function POST(
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
    const { photoUrl, signatureData } = body

    // Fetch the order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .eq('driver_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('[Driver Order Deliver POST] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status !== 'out_for_delivery') {
      return NextResponse.json(
        { error: 'Order must be out for delivery before confirming' },
        { status: 400 }
      )
    }

    // Update order status to delivered
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', id)
      .select('*, customer:profiles!orders_customer_id_fkey(id, full_name), address:addresses(*), items:order_items(*)')
      .single()

    if (updateError || !updatedOrder) {
      console.error('[Driver Order Deliver POST] update error:', updateError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    // Create notification for customer
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: order.customer_id,
        type: 'order_update',
        title: 'Order Delivered',
        message: `Your order #${id.slice(-8)} has been delivered successfully!`,
        link: `/orders/${id}/track`,
      })

    if (notifError) {
      console.error('[Driver Order Deliver POST] notification error:', notifError)
      // Don't fail the delivery confirmation if notification fails
    }

    return NextResponse.json({
      order: updatedOrder,
      deliveryProof: { photoUrl: photoUrl || null, signatureData: signatureData || null },
    })
  } catch (err) {
    console.error('[Driver Order Deliver POST]', err)
    return NextResponse.json({ error: 'Failed to confirm delivery' }, { status: 500 })
  }
}
