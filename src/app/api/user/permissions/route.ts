import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { getEnabledFeaturesList, FEATURE_CATALOG } from '@/lib/feature-permissions'

/**
 * GET /api/user/permissions
 *
 * Returns the current user's enabled features (self-service lookup).
 *
 * Response:
 *   {
 *     features: string[] | null,   // null = full access, array = restricted to listed features
 *     catalog: FeatureCatalogEntry[]  // the catalog entries applicable to the user's role
 *   }
 *
 * Used by client-side layouts (driver, picker) to filter nav items based
 * on the feature permissions set by the admin.
 */
export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const role = user.role.toUpperCase()
  // OWNER always has full access
  if (role === 'OWNER') {
    return NextResponse.json({
      features: null,
      catalog: FEATURE_CATALOG,
      role: user.role,
    })
  }

  const features = await getEnabledFeaturesList(user.id, user.role)

  // Filter catalog to features applicable to this role
  const applicableCatalog = FEATURE_CATALOG.filter((f) =>
    f.appliesTo.includes(role as 'MANAGER' | 'DRIVER' | 'PICKER')
  )

  return NextResponse.json({
    features,
    catalog: applicableCatalog,
    role: user.role,
  })
}
