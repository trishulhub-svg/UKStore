import { getDefaultStore } from '@/lib/supabase/queries'
import { CartClient } from '@/components/customer/cart-client'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
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

  return <CartClient store={store} />
}
