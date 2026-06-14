import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/driver/orders — list assigned + available orders
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (user.role.toLowerCase() !== 'driver') {
    return NextResponse.json({ error: 'Forbidden — driver role required' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseAdmin()

    const orderSelect = '*, customer:profiles!orders_customer_id_fkey(id, full_name, phone), address:addresses(*), items:order_items(*, product:products(id, name, image_url, category:categories(name)))'

    // Orders assigned to this driver
    const { data: assignedOrders, error: assignedError } = await supabase
      .from('orders')
      .select(orderSelect)
      .eq('store_id', STORE_ID)
      .eq('driver_id', user.id)
      .in('status', ['picking', 'ready', 'out_for_delivery'])
      .order('created_at', { ascending: true })

    if (assignedError) {
      console.error('[Driver Orders GET] assigned error:', assignedError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Available orders (ready but no driver assigned)
    const { data: availableOrders, error: availableError } = await supabase
      .from('orders')
      .select(orderSelect)
      .eq('store_id', STORE_ID)
      .is('driver_id', null)
      .in('status', ['picking', 'ready'])
      .order('created_at', { ascending: true })

    if (availableError) {
      console.error('[Driver Orders GET] available error:', availableError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Quick stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday

    const [completedTodayResult, completedThisWeekResult, pickingCountResult] = await Promise.all([
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', STORE_ID)
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .gte('updated_at', today.toISOString()),
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', STORE_ID)
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .gte('updated_at', startOfWeek.toISOString()),
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', STORE_ID)
        .eq('driver_id', user.id)
        .eq('status', 'picking'),
    ])

    return NextResponse.json({
      assignedOrders: assignedOrders || [],
      availableOrders: availableOrders || [],
      stats: {
        completedToday: completedTodayResult.count || 0,
        completedThisWeek: completedThisWeekResult.count || 0,
        pickingCount: pickingCountResult.count || 0,
      },
    })
  } catch (err) {
    console.error('[Driver Orders GET]', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
