import { getServerUser } from '@/lib/auth/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getDefaultStore } from '@/lib/supabase/queries'
import { CheckoutClient } from '@/components/customer/checkout-client'
import type { Address } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  // Guest checkout: a logged-in user is OPTIONAL. If the visitor is signed in,
  // we prefill their addresses and tag the order with their user id. If not,
  // they'll be asked for contact details inline at checkout (one-time guest order).
  const user = await getServerUser()

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

  // Fetch user addresses from Prisma (only if signed in)
  let addresses: Address[] = []
  if (user) {
    try {
      const prisma = await getPrisma()
      const dbAddresses = await prisma.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      })

      addresses = dbAddresses.map((a) => ({
        id: a.id,
        user_id: a.userId,
        label: a.label,
        address_line_1: a.addressLine1,
        address_line_2: a.addressLine2,
        city: a.city,
        postcode: a.postcode,
        latitude: a.latitude,
        longitude: a.longitude,
        is_default: a.isDefault,
        created_at: a.createdAt.toISOString(),
      }))
    } catch (err) {
      console.warn('[Checkout Page] Failed to fetch addresses:', err)
    }
  }

  return (
    <CheckoutClient
      store={store}
      user={user ? { id: user.id, email: user.email, name: user.name || '' } : null}
      addresses={addresses}
    />
  )
}
