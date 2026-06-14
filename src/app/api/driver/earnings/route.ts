import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/driver/earnings — earnings summary
export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (user.role.toLowerCase() !== 'driver') {
    return NextResponse.json({ error: 'Forbidden — driver role required' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseAdmin()

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Completed deliveries for different time periods
    const selectWithRelations = '*, customer:profiles!orders_customer_id_fkey(full_name), address:addresses(address_line_1, postcode)'

    const [todayResult, weekResult, monthResult] = await Promise.all([
      supabase
        .from('orders')
        .select(selectWithRelations)
        .eq('store_id', STORE_ID)
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .gte('updated_at', todayStart.toISOString())
        .order('updated_at', { ascending: false }),
      supabase
        .from('orders')
        .select(selectWithRelations)
        .eq('store_id', STORE_ID)
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .gte('updated_at', weekStart.toISOString())
        .order('updated_at', { ascending: false }),
      supabase
        .from('orders')
        .select(selectWithRelations)
        .eq('store_id', STORE_ID)
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .gte('updated_at', monthStart.toISOString())
        .order('updated_at', { ascending: false }),
    ])

    if (todayResult.error) {
      console.error('[Driver Earnings GET] today error:', todayResult.error)
      return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 })
    }
    if (weekResult.error) {
      console.error('[Driver Earnings GET] week error:', weekResult.error)
      return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 })
    }
    if (monthResult.error) {
      console.error('[Driver Earnings GET] month error:', monthResult.error)
      return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 })
    }

    const todayDeliveries = todayResult.data || []
    const weekDeliveries = weekResult.data || []
    const monthDeliveries = monthResult.data || []

    // Delivery fee is the driver's earning per delivery
    const todayEarnings = todayDeliveries.reduce((sum: number, o: any) => sum + (o.delivery_fee || 0), 0)
    const weekEarnings = weekDeliveries.reduce((sum: number, o: any) => sum + (o.delivery_fee || 0), 0)
    const monthEarnings = monthDeliveries.reduce((sum: number, o: any) => sum + (o.delivery_fee || 0), 0)

    return NextResponse.json({
      today: { deliveries: todayDeliveries.length, earnings: todayEarnings, orders: todayDeliveries },
      thisWeek: { deliveries: weekDeliveries.length, earnings: weekEarnings, orders: weekDeliveries },
      thisMonth: { deliveries: monthDeliveries.length, earnings: monthEarnings, orders: monthDeliveries },
    })
  } catch (err) {
    console.error('[Driver Earnings GET]', err)
    return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 })
  }
}
