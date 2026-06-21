import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import {
  FEATURE_CATALOG,
  setEnabledFeatures,
} from '@/lib/feature-permissions'

/**
 * GET /api/admin/employees/[id]/permissions
 *
 * Returns the feature-permission configuration for an employee.
 *
 * Response:
 *   {
 *     features: string[] | null,   // null = full access, array = restricted to listed features
 *     catalog: FeatureCatalogEntry[]  // the full feature catalog (filtered by the user's role)
 *   }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params

    // Fetch the user to get their role
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const role = user.role.toUpperCase()
    // OWNER can't be restricted
    if (role === 'OWNER') {
      return NextResponse.json({
        features: null,
        catalog: [],
        canRestrict: false,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      })
    }

    // Fetch existing permission row
    const permRow = await prisma.employeeFeaturePermission.findUnique({
      where: { userId: id },
    })

    let features: string[] | null = null
    if (permRow) {
      try {
        features = JSON.parse(permRow.features || '[]')
      } catch {
        features = []
      }
    }

    // Filter catalog to features that apply to this role
    const applicableCatalog = FEATURE_CATALOG.filter((f) =>
      f.appliesTo.includes(role as 'MANAGER' | 'DRIVER' | 'PICKER')
    )

    return NextResponse.json({
      features,
      catalog: applicableCatalog,
      canRestrict: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    console.error('[Admin Employee Permissions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/employees/[id]/permissions
 *
 * Sets the feature-permission configuration for an employee.
 *
 * Body:
 *   - features: string[] | null
 *     - null → remove restriction (full access)
 *     - string[] → only these features are accessible
 *
 * Only OWNER can change permissions. MANAGERs cannot.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAdmin()
  if (error) return error

  // Only OWNER can modify permissions
  if (user.role.toUpperCase() !== 'OWNER') {
    return NextResponse.json(
      { error: 'Only the store owner can modify employee feature permissions' },
      { status: 403 }
    )
  }

  try {
    const prisma = await getPrisma()
    const { id } = await params

    // Fetch the target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const role = targetUser.role.toUpperCase()
    // OWNER can't be restricted
    if (role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot restrict the store owner account' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { features } = body

    let normalizedFeatures: string[] | null

    if (features === null || features === undefined) {
      // Remove restriction (full access)
      normalizedFeatures = null
    } else if (Array.isArray(features)) {
      // Validate: all features must be strings
      const validKeys = new Set(FEATURE_CATALOG.map((f) => f.key))
      const filtered = features.filter(
        (f) => typeof f === 'string' && validKeys.has(f)
      )

      // Filter to features applicable to this role
      const applicableKeys = new Set(
        FEATURE_CATALOG.filter((f) =>
          f.appliesTo.includes(role as 'MANAGER' | 'DRIVER' | 'PICKER')
        ).map((f) => f.key)
      )
      normalizedFeatures = filtered.filter((f) => applicableKeys.has(f))
    } else {
      return NextResponse.json(
        { error: 'features must be an array of feature keys or null' },
        { status: 400 }
      )
    }

    await setEnabledFeatures(id, normalizedFeatures)

    return NextResponse.json({
      success: true,
      features: normalizedFeatures,
    })
  } catch (err) {
    console.error('[Admin Employee Permissions PUT]', err)
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
  }
}
