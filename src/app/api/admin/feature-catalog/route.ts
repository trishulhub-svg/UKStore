import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { FEATURE_CATALOG } from '@/lib/feature-permissions'

/**
 * GET /api/admin/feature-catalog
 *
 * Returns the full feature catalog (used by the Create Employee dialog
 * to render the feature-permission checkboxes before the user exists).
 *
 * Response:
 *   {
 *     catalog: FeatureCatalogEntry[]
 *   }
 */
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  return NextResponse.json({
    catalog: FEATURE_CATALOG,
  })
}
