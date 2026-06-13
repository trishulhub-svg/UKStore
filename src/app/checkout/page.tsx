import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
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

  // Addresses require Supabase tables - will be empty when using local auth
  const addresses: Address[] = []

  return (
    <CheckoutClient
      store={store}
      user={{ id: user.id, email: user.email, name: user.name }}
      addresses={addresses}
    />
  )
}
