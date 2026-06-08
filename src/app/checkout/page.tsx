import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDefaultStore } from '@/lib/supabase/queries'
import { CheckoutClient } from '@/components/customer/checkout-client'
import type { Address } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  // Get user's saved addresses
  let addresses: Address[] = []
  try {
    const { data: addressData } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })

    if (addressData) {
      addresses = addressData as Address[]
    }
  } catch {
    // Addresses table might not exist yet, continue with empty array
  }

  return (
    <CheckoutClient
      store={store}
      user={{ id: user.id, email: user.email || '', name: user.user_metadata?.full_name || '' }}
      addresses={addresses}
    />
  )
}
