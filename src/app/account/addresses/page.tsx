import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { AddressesClient } from '@/components/customer/addresses-client'

export const dynamic = 'force-dynamic'

export default async function AddressesPage() {
  const user = await getServerUser()
  if (!user) {
    redirect('/auth/login?redirect=/account/addresses')
  }

  return (
    <CustomerLayout>
      <AddressesClient />
    </CustomerLayout>
  )
}
