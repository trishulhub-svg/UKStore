import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { NotificationsClient } from '@/components/customer/notifications-client'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = await getServerUser()
  if (!user) {
    redirect('/auth/login?redirect=/account/notifications')
  }

  return (
    <CustomerLayout>
      <NotificationsClient />
    </CustomerLayout>
  )
}
