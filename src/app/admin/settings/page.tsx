import { createClient } from '@/lib/supabase/server'
import { AdminSettingsClient } from '@/components/admin/admin-settings-client'
import type { StoreSetting } from '@/types'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch current settings from DB
  let settings: StoreSetting[] = []
  try {
    const { data } = await supabase
      .from('store_settings')
      .select('*')
      .eq('store_id', STORE_ID)
      .order('category', { ascending: true })

    if (data) {
      settings = data as StoreSetting[]
    }
  } catch {
    // Settings table might not exist yet (migration not run)
  }

  return (
    <AdminSettingsClient
      settings={settings}
      userId={user?.id || ''}
    />
  )
}
