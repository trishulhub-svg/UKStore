import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { AdminSettingsClient } from '@/components/admin/admin-settings-client'
import type { StoreSetting } from '@/types'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AdminSettingsPage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin/settings')
  }

  // Fetch settings from Supabase
  let settings: StoreSetting[] = []
  try {
    const supabase = getSupabaseAdmin()
    const { data: dbSettings, error: dbError } = await supabase
      .from('store_settings')
      .select('*')
      .eq('store_id', STORE_ID)

    if (dbError) {
      console.warn('[Admin Settings Page] Failed to fetch settings:', dbError)
    } else {
      settings = (dbSettings || []).map((s: any) => ({
        id: s.id,
        store_id: s.store_id,
        key: s.key,
        value: s.value,
        is_secret: s.is_secret,
        category: s.category as StoreSetting['category'],
        description: s.description,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }))
    }
  } catch (err) {
    console.warn('[Admin Settings Page] Failed to fetch settings:', err)
  }

  return (
    <AdminSettingsClient
      settings={settings}
      userId={user.id}
    />
  )
}
