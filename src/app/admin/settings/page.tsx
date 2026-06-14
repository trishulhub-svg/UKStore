import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { getPrisma } from '@/lib/auth/prisma'
import { AdminSettingsClient } from '@/components/admin/admin-settings-client'
import type { StoreSetting } from '@/types'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AdminSettingsPage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin/settings')
  }

  // Fetch settings from Prisma
  let settings: StoreSetting[] = []
  try {
    const prisma = await getPrisma()
    const dbSettings = await prisma.storeSetting.findMany({
      where: { storeId: STORE_ID },
    })

    settings = dbSettings.map((s) => ({
      id: s.id,
      store_id: s.storeId,
      key: s.key,
      value: s.value,
      is_secret: s.isSecret,
      category: s.category as StoreSetting['category'],
      description: s.description,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }))
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
