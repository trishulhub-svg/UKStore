import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { OrderTrackingClient } from '@/components/customer/order-tracking-client'

export const dynamic = 'force-dynamic'

export default async function OrderTrackPage() {
  const user = await getServerUser()
  if (!user) {
    redirect('/auth/login?redirect=/orders')
  }

  return (
    <CustomerLayout>
      <OrderTrackingClient />
    </CustomerLayout>
  )
}
