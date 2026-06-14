import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { OrdersClient } from '@/components/customer/orders-client'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const user = await getServerUser()
  if (!user) {
    redirect('/auth/login?redirect=/orders')
  }

  return (
    <CustomerLayout>
      <OrdersClient />
    </CustomerLayout>
  )
}
