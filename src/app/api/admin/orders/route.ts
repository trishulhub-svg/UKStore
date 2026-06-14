import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/orders — list orders with filters
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build query for orders with joins
    let query = supabase
      .from('orders')
      .select('*, customer:profiles!customer_id(id, full_name, email), driver:profiles!driver_id(id, full_name), items:order_items(*)', { count: 'exact' })
      .eq('store_id', STORE_ID)

    if (status) {
      query = query.eq('status', status)
    }
    if (search) {
      // Search by order ID or customer name/email
      query = query.or(`id.ilike.%${search}%,customer.full_name.ilike.%${search}%,customer.email.ilike.%${search}%`)
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, (page - 1) * limit + limit - 1)

    const { data: orders, error: dbError, count } = await query

    if (dbError) {
      console.error('[Admin Orders GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Map customer full_name to name for backward compatibility
    const mapped = (orders || []).map((o: any) => ({
      ...o,
      customer: o.customer ? { ...o.customer, name: o.customer.full_name } : null,
      driver: o.driver ? { ...o.driver, name: o.driver.full_name } : null,
    }))

    return NextResponse.json({ orders: mapped, total: count, page, limit })
  } catch (err) {
    console.error('[Admin Orders GET]', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// PATCH /api/admin/orders — update order status
export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { orderId, status, driverId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    // Check existence
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Orders PATCH] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (status) data.status = status
    if (driverId !== undefined) data.driver_id = driverId || null

    const { data: order, error: dbError } = await supabase
      .from('orders')
      .update(data)
      .eq('id', orderId)
      .select('*, customer:profiles!customer_id(id, full_name, email), driver:profiles!driver_id(id, full_name), items:order_items(*)')
      .single()

    if (dbError) {
      console.error('[Admin Orders PATCH]', dbError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    // Map full_name to name for backward compatibility
    const mapped = {
      ...order,
      customer: (order as any).customer ? { ...(order as any).customer, name: (order as any).customer.full_name } : null,
      driver: (order as any).driver ? { ...(order as any).driver, name: (order as any).driver.full_name } : null,
    }

    return NextResponse.json({ order: mapped })
  } catch (err) {
    console.error('[Admin Orders PATCH]', err)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
