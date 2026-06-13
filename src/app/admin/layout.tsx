import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { AdminShell } from '@/components/admin/admin-shell'
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

  // Check user's role - only owners can access admin
  if (user.role !== 'owner') {
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
            Only store owners can access the admin dashboard. Your current role is <strong>{user.role}</strong>.
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
    full_name: user.name,
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
    >
      {children}
    </AdminShell>
  )
}
