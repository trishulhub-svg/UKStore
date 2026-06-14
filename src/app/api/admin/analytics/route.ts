import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/analytics — aggregated stats
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Revenue last 30 days (daily)
    const { data: ordersLast30, error: ordersError } = await supabase
      .from('orders')
      .select('total, created_at, status')
      .eq('store_id', STORE_ID)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('[Admin Analytics GET] orders30 error:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    // Group revenue by day
    const revenueByDay: Record<string, number> = {}
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      revenueByDay[key] = 0
    }
    ;(ordersLast30 || []).forEach((o: any) => {
      const key = new Date(o.created_at).toISOString().split('T')[0]
      if (key in revenueByDay) {
        revenueByDay[key] += Number(o.total) || 0
      }
    })

    const revenueChart = Object.entries(revenueByDay).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
    }))

    // Orders by status
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('status')
      .eq('store_id', STORE_ID)

    if (allOrdersError) {
      console.error('[Admin Analytics GET] allOrders error:', allOrdersError)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    const ordersByStatus: Record<string, number> = {}
    ;(allOrders || []).forEach((o: any) => {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1
    })

    const statusPieChart = Object.entries(ordersByStatus).map(([status, count]) => ({
      status,
      count,
    }))

    // Top selling products (by quantity in order items)
    const { data: topProductsRaw, error: topProductsError } = await supabase
      .from('order_items')
      .select('product_id, product_name, quantity, subtotal')

    if (topProductsError) {
      console.error('[Admin Analytics GET] topProducts error:', topProductsError)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    // Group by product and sum in JS
    const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {}
    ;(topProductsRaw || []).forEach((item: any) => {
      const key = item.product_id
      if (!productMap[key]) {
        productMap[key] = { name: item.product_name, quantity: 0, revenue: 0 }
      }
      productMap[key].quantity += item.quantity || 0
      productMap[key].revenue += Number(item.subtotal) || 0
    })

    const topProductsChart = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    // Delivery performance
    const { data: deliveredOrders, error: deliveredError } = await supabase
      .from('orders')
      .select('created_at, updated_at')
      .eq('store_id', STORE_ID)
      .eq('status', 'delivered')

    if (deliveredError) {
      console.error('[Admin Analytics GET] delivered error:', deliveredError)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    const avgDeliveryMinutes = (deliveredOrders || []).length > 0
      ? (deliveredOrders || []).reduce((sum: number, o: any) => {
          const diff = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()
          return sum + diff / (1000 * 60)
        }, 0) / (deliveredOrders || []).length
      : 0

    // Summary stats — run in parallel
    const [
      { count: totalProducts, error: productsCountError },
      { count: totalOrders, error: ordersCountError },
      { count: totalCustomers, error: customersCountError },
      { data: revenueData, error: revenueError },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', STORE_ID),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', STORE_ID),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('orders').select('total').eq('store_id', STORE_ID).neq('status', 'cancelled'),
    ])

    if (productsCountError || ordersCountError || customersCountError || revenueError) {
      console.error('[Admin Analytics GET] summary stats error:', {
        productsCountError, ordersCountError, customersCountError, revenueError,
      })
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    const totalRevenue = (revenueData || []).reduce((sum: number, r: any) => sum + (Number(r.total) || 0), 0)

    return NextResponse.json({
      summary: {
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0,
        totalCustomers: totalCustomers || 0,
        totalRevenue,
        avgDeliveryMinutes: Math.round(avgDeliveryMinutes),
        deliveredCount: (deliveredOrders || []).length,
      },
      revenueChart,
      statusPieChart,
      topProductsChart,
    })
  } catch (err) {
    console.error('[Admin Analytics GET]', err)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
