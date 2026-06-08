import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDefaultStore } from '@/lib/supabase/queries'
import { AccountClient } from '@/components/customer/account-client'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/account')
  }

  const store = await getDefaultStore()

  // Get user's orders
  let orders: Order[] = []
  try {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (orderData) {
      orders = orderData as Order[]
    }
  } catch {
    // Orders table might not exist yet
  }

  return (
    <AccountClient
      storeName={store?.name || 'Fresh Mart London'}
      user={{
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || '',
        createdAt: user.created_at,
      }}
      orders={orders}
    />
  )
}
