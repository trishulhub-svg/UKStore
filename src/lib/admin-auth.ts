// ============================================================
// Admin API auth helper
// Checks that the requesting user has OWNER or MANAGER role
// Optionally checks feature-permission access for non-owner users
// ============================================================

import { getServerUser } from '@/lib/auth/server'
import { NextResponse } from 'next/server'
import { hasFeatureAccess } from '@/lib/feature-permissions'

interface RequireAdminOptions {
  /** If set, the user must have this feature enabled. OWNER bypasses. */
  feature?: string
}

export async function requireAdmin(options?: RequireAdminOptions) {
  const user = await getServerUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
      user: null,
    }
  }

  const role = user.role.toUpperCase()
  if (role !== 'OWNER' && role !== 'MANAGER') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — owner or manager role required' },
        { status: 403 }
      ),
      user: null,
    }
  }

  // Feature-permission check (OWNER bypasses — full access always)
  if (options?.feature && role !== 'OWNER') {
    const hasAccess = await hasFeatureAccess(user.id, user.role, options.feature)
    if (!hasAccess) {
      return {
        error: NextResponse.json(
          {
            error: 'Access denied — this feature is not enabled for your account.',
            code: 'FEATURE_NOT_ENABLED',
            feature: options.feature,
          },
          { status: 403 }
        ),
        user: null,
      }
    }
  }

  return { error: null, user }
}

/**
 * Employee API guard — used by /api/driver/* and /api/picker/* routes.
 *
 * Checks that the user is authenticated and (for feature-gated routes)
 * has the required feature enabled.
 *
 * Note: driver/picker role enforcement is done separately by callers
 * (e.g. driver routes check role === 'DRIVER').
 */
export async function requireEmployee(options?: RequireAdminOptions) {
  const user = await getServerUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
      user: null,
    }
  }

  const role = user.role.toUpperCase()
  // Employees are DRIVER, PICKER, MANAGER, OWNER (admins can preview employee UIs)
  if (!['DRIVER', 'PICKER', 'MANAGER', 'OWNER'].includes(role)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — employee role required' },
        { status: 403 }
      ),
      user: null,
    }
  }

  if (options?.feature && role !== 'OWNER') {
    const hasAccess = await hasFeatureAccess(user.id, user.role, options.feature)
    if (!hasAccess) {
      return {
        error: NextResponse.json(
          {
            error: 'Access denied — this feature is not enabled for your account.',
            code: 'FEATURE_NOT_ENABLED',
            feature: options.feature,
          },
          { status: 403 }
        ),
        user: null,
      }
    }
  }

  return { error: null, user }
}
