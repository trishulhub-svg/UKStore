import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AdminDashboardPage() {
  const supabase = getSupabaseAdmin()

  // Get today's date at midnight UTC for filtering
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  // Get date 7 days ago for revenue chart
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setUTCHours(0, 0, 0, 0)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // includes today = 7 days total
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  // Default data structures for graceful empty state handling
  const dashboardData = {
    todayRevenue: 0,
    ordersToday: 0,
    ordersTodayBreakdown: {
      placed: 0,
      confirmed: 0,
      picking: 0,
      ready: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    },
    activeDeliveries: 0,
    pendingOrders: 0,
    revenueChart: [] as { date: string; revenue: number }[],
    orderStatusBreakdown: [] as { status: string; count: number }[],
    recentOrders: [] as {
      id: string
      status: string
      total: number
      created_at: string
      customer: { name: string; email: string } | null
    }[],
    activeDrivers: [] as {
      user_id: string
      vehicle_type: string | null
      full_name: string | null
    }[],
    lowStockProducts: [] as {
      id: string
      name: string
      stock_quantity: number
      category: { name: string } | null
    }[],
  }

  try {
    // Run all independent queries in parallel
    const [
      todayOrdersResult,
      allOrdersForStatusResult,
      ordersLast7DaysResult,
      recentOrdersResult,
      activeDriversResult,
      lowStockResult,
    ] = await Promise.all([
      // Today's orders (for revenue + count + breakdown)
      supabase
        .from('orders')
        .select('id, status, total, created_at')
        .eq('store_id', STORE_ID)
        .gte('created_at', todayISO),

      // All orders for status breakdown (pie chart)
      supabase
        .from('orders')
        .select('status')
        .eq('store_id', STORE_ID),

      // Orders from last 7 days (revenue chart)
      supabase
        .from('orders')
        .select('total, created_at, status')
        .eq('store_id', STORE_ID)
        .gte('created_at', sevenDaysAgoISO),

      // Recent 5 orders with customer info
      supabase
        .from('orders')
        .select('id, status, total, created_at, customer:profiles!customer_id(full_name, email)')
        .eq('store_id', STORE_ID)
        .order('created_at', { ascending: false })
        .limit(5),

      // Active drivers on duty with profile info
      supabase
        .from('driver_profiles')
        .select('user_id, vehicle_type, is_on_duty, profile:profiles!user_id(full_name)')
        .eq('is_on_duty', true),

      // Low stock products (stock < 10)
      supabase
        .from('products')
        .select('id, name, stock_quantity, category:categories!category_id(name)')
        .eq('store_id', STORE_ID)
        .lt('stock_quantity', 10)
        .order('stock_quantity', { ascending: true })
        .limit(10),
    ])

    // Log any errors
    if (todayOrdersResult.error) console.error('[Admin Dashboard] today orders error:', todayOrdersResult.error)
    if (allOrdersForStatusResult.error) console.error('[Admin Dashboard] status breakdown error:', allOrdersForStatusResult.error)
    if (ordersLast7DaysResult.error) console.error('[Admin Dashboard] 7-day orders error:', ordersLast7DaysResult.error)
    if (recentOrdersResult.error) console.error('[Admin Dashboard] recent orders error:', recentOrdersResult.error)
    if (activeDriversResult.error) console.error('[Admin Dashboard] active drivers error:', activeDriversResult.error)
    if (lowStockResult.error) console.error('[Admin Dashboard] low stock error:', lowStockResult.error)

    // ─── Process Today's Revenue & Orders ─────────────────
    const todayOrders = todayOrdersResult.data || []
    let todayRevenue = 0
    const breakdown = {
      placed: 0,
      confirmed: 0,
      picking: 0,
      ready: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    }

    for (const order of todayOrders) {
      if (order.status !== 'cancelled') {
        todayRevenue += Number(order.total) || 0
      }
      const s = order.status as string
      if (s in breakdown) {
        breakdown[s as keyof typeof breakdown]++
      }
    }

    dashboardData.todayRevenue = todayRevenue
    dashboardData.ordersToday = todayOrders.length
    dashboardData.ordersTodayBreakdown = breakdown

    // ─── Active Deliveries & Pending Orders ─────────────────
    const activeStatuses = ['out_for_delivery', 'picking', 'ready']
    const pendingStatuses = ['placed', 'confirmed']

    dashboardData.activeDeliveries = todayOrders.filter(
      (o) => activeStatuses.includes(o.status)
    ).length
    dashboardData.pendingOrders = todayOrders.filter(
      (o) => pendingStatuses.includes(o.status)
    ).length

    // Also count active/pending from all orders (not just today) for real-time status
    const allOrders = allOrdersForStatusResult.data || []
    const allActiveCount = allOrders.filter(
      (o) => activeStatuses.includes(o.status)
    ).length
    const allPendingCount = allOrders.filter(
      (o) => pendingStatuses.includes(o.status)
    ).length

    // Use whichever is larger (today-specific vs all-time active)
    dashboardData.activeDeliveries = Math.max(dashboardData.activeDeliveries, allActiveCount)
    dashboardData.pendingOrders = Math.max(dashboardData.pendingOrders, allPendingCount)

    // ─── Revenue Chart (Last 7 Days) ─────────────────────
    const last7DaysOrders = ordersLast7DaysResult.data || []

    // Build a map for each of the last 7 days
    const dayMap = new Map<string, number>()
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().split('T')[0] // YYYY-MM-DD
      dayMap.set(key, 0)
    }

    for (const order of last7DaysOrders) {
      if (order.status === 'cancelled') continue
      const dateKey = (order.created_at as string).split('T')[0]
      if (dayMap.has(dateKey)) {
        dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + (Number(order.total) || 0))
      }
    }

    dashboardData.revenueChart = Array.from(dayMap.entries()).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue * 100) / 100,
    }))

    // ─── Order Status Breakdown (Pie Chart) ──────────────
    const statusCounts = new Map<string, number>()
    const statusOrder = ['placed', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'delivered', 'cancelled']
    for (const status of statusOrder) {
      statusCounts.set(status, 0)
    }
    for (const order of allOrders) {
      const s = order.status as string
      statusCounts.set(s, (statusCounts.get(s) || 0) + 1)
    }

    dashboardData.orderStatusBreakdown = Array.from(statusCounts.entries())
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ status, count }))

    // ─── Recent Orders ─────────────────────────────────────
    dashboardData.recentOrders = (recentOrdersResult.data || []).map((o: any) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
      customer: o.customer ? { name: o.customer.full_name, email: o.customer.email } : null,
    }))

    // ─── Active Drivers ────────────────────────────────────
    dashboardData.activeDrivers = (activeDriversResult.data || []).map((d: any) => ({
      user_id: d.user_id,
      vehicle_type: d.vehicle_type,
      full_name: d.profile?.full_name || null,
    }))

    // ─── Low Stock Products ────────────────────────────────
    dashboardData.lowStockProducts = (lowStockResult.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      stock_quantity: p.stock_quantity,
      category: p.category ? { name: p.category.name } : null,
    }))

  } catch (err) {
    console.error('[Admin Dashboard] Error fetching dashboard data:', err)
  }

  return <AdminDashboardClient data={dashboardData} />
}
