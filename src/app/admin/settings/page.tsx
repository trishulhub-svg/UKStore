import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { getPrisma } from '@/lib/auth/prisma'
import { AdminSettingsClient } from '@/components/admin/admin-settings-client'
import { StoreStatusManager } from '@/components/admin/store-status-manager'
import { BankHolidayManager } from '@/components/admin/bank-holiday-manager'
import { NotificationEditor } from '@/components/admin/notification-editor'
import { StoreProfileEditor } from '@/components/admin/store-profile-editor'
import type { StoreSetting } from '@/types'

export const dynamic = 'force-dynamic'

const STORE_ID = 'store-fresh-mart-001'

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
    <div>
      {/* Store Profile — Name, Address, Contact Details */}
      <StoreProfileEditor />

      {/* Separator */}
      <div className="my-8 border-t border-gray-200" />

      {/* Store Status & Delivery — Always visible at top */}
      <StoreStatusManager />

      {/* Separator */}
      <div className="my-8 border-t border-gray-200" />

      {/* Bank Holiday Manager */}
      <BankHolidayManager />

      {/* Separator */}
      <div className="my-8 border-t border-gray-200" />

      {/* Notification Editor */}
      <NotificationEditor />

      {/* Separator */}
      <div className="my-8 border-t border-gray-200" />

      {/* API Keys & Settings */}
      <AdminSettingsClient
        settings={settings}
        userId={user.id}
      />
    </div>
  )
}
