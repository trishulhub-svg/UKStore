import { createServiceClient } from '@/lib/supabase/server'
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AdminDashboardPage() {
  const supabase = createServiceClient()

  // Default stats when Supabase is not available
  let stats = {
    products: 0,
    orders: 0,
    customers: 0,
    configuredKeys: 0,
    totalKeys: 0,
  }
  let recentOrders: Array<Record<string, unknown>> = []

  if (supabase) {
    try {
      const [
        { count: productCount },
        { count: orderCount },
        { count: customerCount },
        { data: recentOrdersData },
        { data: settings },
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', STORE_ID),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', STORE_ID),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('store_id', STORE_ID).eq('role', 'customer'),
        supabase.from('orders').select('*').eq('store_id', STORE_ID).order('created_at', { ascending: false }).limit(5),
        supabase.from('store_settings').select('key, value, is_secret, category').eq('store_id', STORE_ID),
      ])

      // Check which integrations are configured
      const configuredKeys = (settings || []).filter((s) => s.value && s.value.length > 0)
      const totalKeys = (settings || []).length

      stats = {
        products: productCount || 0,
        orders: orderCount || 0,
        customers: customerCount || 0,
        configuredKeys: configuredKeys.length,
        totalKeys: totalKeys,
      }
      recentOrders = (recentOrdersData || []) as Array<Record<string, unknown>>
    } catch {
      // Use default empty stats
    }
  }

  return (
    <AdminDashboardClient
      stats={stats}
      recentOrders={recentOrders}
    />
  )
}
