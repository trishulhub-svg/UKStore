import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { AdminShell } from '@/components/admin/admin-shell'
import { getEnabledFeaturesList, hasAnyAdminFeature } from '@/lib/feature-permissions'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin')
  }

  // Fetch feature permissions for the user (null = full access, array = restricted to listed features)
  // OWNER always returns null (full access). Other roles may have a restriction row.
  const enabledFeatures = await getEnabledFeaturesList(user.id, user.role)

  // Check user's role - owners and managers always have access.
  // Drivers/pickers can access /admin/* ONLY if they have at least one
  // admin-group feature enabled (e.g. `orders`, `kanban`, `wastage`).
  // This supports the "owner grants admin features to picker/driver" workflow.
  const role = user.role.toUpperCase()
  const isOwnerOrManager = role === 'OWNER' || role === 'MANAGER'
  const isEmployeeWithAdminFeature =
    (role === 'DRIVER' || role === 'PICKER') && hasAnyAdminFeature(enabledFeatures)

  if (!isOwnerOrManager && !isEmployeeWithAdminFeature) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don&apos;t have permission to access the admin dashboard. Your current role is <strong>{user.role}</strong>.
            {role === 'DRIVER' || role === 'PICKER'
              ? ' Ask the store owner to grant you admin feature permissions.'
              : ''}
          </p>
          <a href="/" className="inline-flex items-center px-4 py-2 bg-[#16a34a] text-white rounded-md hover:bg-[#15803d] font-medium">
            Return to Store
          </a>
        </div>
      </div>
    )
  }

  // Construct a Profile-like object from the local auth user
  const profile: Profile = {
    id: user.id,
    store_id: '',
    email: user.email,
    full_name: user.name || '',
    phone: null,
    role: user.role as Profile['role'],
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <AdminShell
      profile={profile}
      userEmail={user.email}
      userRole={user.role}
      enabledFeatures={enabledFeatures}
    >
      {children}
    </AdminShell>
  )
}
