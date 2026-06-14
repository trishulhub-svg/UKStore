import { requireAdmin } from '@/lib/admin-auth'
import { WastageClient } from '@/components/admin/wastage-client'

export default async function WastagePage() {
  const { error } = await requireAdmin()
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Access denied</p>
      </div>
    )
  }

  return <WastageClient />
}
