import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getEnabledFeaturesList, FEATURE_CATALOG } from '@/lib/feature-permissions'

/**
 * GET /api/user/permissions
 *
 * Returns the current user's enabled features (self-service lookup).
 *
 * Response:
 *   {
 *     features: string[] | null,   // null = full access, array = restricted to listed features
 *     catalog: FeatureCatalogEntry[],  // the catalog entries applicable to the user's role
 *     role: string,                // primary role (e.g. 'PICKER')
 *     roles: string[]              // primary + additionalRoles (e.g. ['PICKER','DRIVER'])
 *   }
 *
 * Used by client-side layouts (driver, picker) to filter nav items based
 * on the feature permissions set by the admin, AND to gate access by role.
 * The `roles` array enables dual-role access — e.g. a user whose primary
 * role is PICKER but who also has DRIVER in additionalRoles can access
 * both /picker and /driver dashboards.
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
      roles: ['OWNER'],
    })
  }

  // Fetch additionalRoles from the DB so the client layouts can grant
  // access to multiple dashboards (e.g. PICKER + DRIVER) for dual-role staff.
  let roles: string[] = [role]
  try {
    const prisma = await getPrisma()
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { additionalRoles: true },
    })
    if (u?.additionalRoles) {
      try {
        const extra: string[] = JSON.parse(u.additionalRoles)
        if (Array.isArray(extra)) {
          // Merge, uppercase, dedupe, drop unknown values
          const valid = new Set(['DRIVER', 'PICKER', 'MANAGER'])
          const merged = new Set<string>([role])
          for (const r of extra) {
            const up = String(r).toUpperCase().trim()
            if (valid.has(up)) merged.add(up)
          }
          roles = Array.from(merged)
        }
      } catch {
        // Malformed JSON — ignore, fall back to primary role only
      }
    }
  } catch (err) {
    console.error('[/api/user/permissions] Failed to load additionalRoles:', err)
  }

  const features = await getEnabledFeaturesList(user.id, user.role)

  // Filter catalog to features applicable to ANY of the user's roles
  // (so a PICKER+DRIVER dual-role user sees both picker and driver features)
  const applicableCatalog = FEATURE_CATALOG.filter((f) =>
    f.appliesTo.some((r) => roles.includes(r))
  )

  return NextResponse.json({
    features,
    catalog: applicableCatalog,
    role: user.role,
    roles,
  })
}
