import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AdminDashboardPage() {
  const supabase = getSupabaseAdmin()

  let stats = {
    products: 0,
    orders: 0,
    customers: 0,
    configuredKeys: 0,
    totalKeys: 0,
  }
  let recentOrders: any[] = []

  try {
    const [
      { count: productCount, error: productsError },
      { count: orderCount, error: ordersError },
      { count: customerCount, error: customersError },
      { data: recentOrdersData, error: recentError },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', STORE_ID),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', STORE_ID),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'CUSTOMER'),
      supabase
        .from('orders')
        .select('id, status, total, created_at, customer:profiles!customer_id(full_name, email)')
        .eq('store_id', STORE_ID)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (productsError) console.error('[Admin Dashboard] products count error:', productsError)
    if (ordersError) console.error('[Admin Dashboard] orders count error:', ordersError)
    if (customersError) console.error('[Admin Dashboard] customers count error:', customersError)
    if (recentError) console.error('[Admin Dashboard] recent orders error:', recentError)

    const { count: settingsCount, error: settingsCountError } = await supabase
      .from('store_settings')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', STORE_ID)

    const { count: configuredCount, error: configuredCountError } = await supabase
      .from('store_settings')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', STORE_ID)
      .neq('value', '')

    if (settingsCountError) console.error('[Admin Dashboard] settings count error:', settingsCountError)
    if (configuredCountError) console.error('[Admin Dashboard] configured count error:', configuredCountError)

    stats = {
      products: productCount || 0,
      orders: orderCount || 0,
      customers: customerCount || 0,
      configuredKeys: configuredCount || 0,
      totalKeys: settingsCount || 0,
    }

    recentOrders = (recentOrdersData || []).map((o: any) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
      customer: o.customer ? { name: o.customer.full_name, email: o.customer.email } : null,
    }))
  } catch (err) {
    console.error('[Admin Dashboard] Error fetching stats:', err)
  }

  return (
    <AdminDashboardClient
      stats={stats}
      recentOrders={recentOrders}
    />
  )
}
