import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { ProfileClient } from '@/components/account/profile-client'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await getServerUser()
  if (!user) {
    redirect('/auth/login?redirect=/account/profile')
  }

  return <ProfileClient user={user} />
}
