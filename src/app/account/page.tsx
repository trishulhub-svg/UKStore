import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { getDefaultStore } from '@/lib/supabase/queries'
import { AccountClient } from '@/components/customer/account-client'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/account')
  }

  const store = await getDefaultStore()

  // Orders require Supabase tables - will be empty when using local auth
  // In a full setup, these would be fetched from the database
  const orders: Order[] = []

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
