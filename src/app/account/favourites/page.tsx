import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { FavouritesClient } from '@/components/customer/favourites-client'

export const dynamic = 'force-dynamic'

export default async function FavouritesPage() {
  const user = await getServerUser()
  if (!user) {
    redirect('/auth/login?redirect=/account/favourites')
  }

  return (
    <CustomerLayout>
      <FavouritesClient />
    </CustomerLayout>
  )
}
