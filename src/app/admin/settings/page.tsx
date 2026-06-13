import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { AdminSettingsClient } from '@/components/admin/admin-settings-client'
import type { StoreSetting } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin/settings')
  }

  // Settings require Supabase tables - will be empty when using local auth
  const settings: StoreSetting[] = []

  return (
    <AdminSettingsClient
      settings={settings}
      userId={user.id}
    />
  )
}
