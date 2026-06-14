import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getDefaultStore } from '@/lib/supabase/queries'
import { AccountClient } from '@/components/customer/account-client'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AccountPage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/account')
  }

  const store = await getDefaultStore()

  // Fetch user orders from Supabase
  let orders: Order[] = []
  try {
    const supabase = getSupabaseAdmin()

    const { data: dbOrders, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(name, image_url))')
      .eq('customer_id', user.id)
      .eq('store_id', STORE_ID)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.warn('[Account Page] Failed to fetch orders:', error.message)
    } else if (dbOrders) {
      orders = dbOrders.map((o: any) => ({
        id: o.id,
        store_id: o.store_id,
        customer_id: o.customer_id,
        driver_id: o.driver_id,
        address_id: o.address_id,
        status: o.status as Order['status'],
        subtotal: o.subtotal,
        vat_amount: o.vat_amount,
        delivery_fee: o.delivery_fee,
        total: o.total,
        stripe_session_id: o.stripe_session_id,
        stripe_payment_intent_id: o.stripe_payment_intent_id,
        payment_status: o.payment_status as Order['payment_status'],
        delivery_slot: o.delivery_slot,
        notes: o.notes,
        created_at: o.created_at,
        updated_at: o.updated_at,
      }))
    }
  } catch (err) {
    console.warn('[Account Page] Failed to fetch orders:', err)
  }

  return (
    <AccountClient
      storeName={store?.name || 'Fresh Mart London'}
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date().toISOString(),
        role: user.role,
      }}
      orders={orders}
    />
  )
}
