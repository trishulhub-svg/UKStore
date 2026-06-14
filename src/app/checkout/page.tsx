import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getDefaultStore } from '@/lib/supabase/queries'
import { CheckoutClient } from '@/components/customer/checkout-client'
import type { Address } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/checkout')
  }

  const store = await getDefaultStore()

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Available</h1>
          <p className="text-gray-500">We&apos;re sorry, the store is currently unavailable.</p>
        </div>
      </div>
    )
  }

  // Fetch user addresses from Supabase
  let addresses: Address[] = []
  try {
    const supabase = getSupabaseAdmin()

    const { data: dbAddresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[Checkout Page] Failed to fetch addresses:', error.message)
    } else if (dbAddresses) {
      // Supabase returns snake_case directly — map to Address type
      addresses = dbAddresses.map((a: any) => ({
        id: a.id,
        user_id: a.user_id,
        label: a.label,
        address_line_1: a.address_line_1,
        address_line_2: a.address_line_2,
        city: a.city,
        postcode: a.postcode,
        latitude: a.latitude,
        longitude: a.longitude,
        is_default: a.is_default,
        created_at: a.created_at,
      }))
    }
  } catch (err) {
    console.warn('[Checkout Page] Failed to fetch addresses:', err)
  }

  return (
    <CheckoutClient
      store={store}
      user={{ id: user.id, email: user.email, name: user.name }}
      addresses={addresses}
    />
  )
}
