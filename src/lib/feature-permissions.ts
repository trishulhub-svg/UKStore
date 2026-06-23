// ============================================================
// Employee Feature Permissions
//
// Defines the catalog of toggleable features and provides helpers
// for checking whether a user has access to a specific feature.
//
// Default behavior:
//   - OWNER role: full access to everything (cannot be restricted)
//   - Other employees (MANAGER / DRIVER / PICKER): if no
//     EmployeeFeaturePermission row exists → full access (default open).
//     If a row exists → only the listed features are accessible.
//
// All features are toggleable for ALL non-OWNER roles. The `group`
// field is purely for UI categorization (Admin / Driver / Picker),
// not a hard restriction. Owner can grant any feature to any employee.
// ============================================================

import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'
import { NextResponse } from 'next/server'

// ─── Feature Catalog ─────────────────────────────────────────
// Each feature key maps to a human-readable label, description, and
// the set of employee roles it can be toggled for.

export interface FeatureCatalogEntry {
  key: string
  label: string
  description: string
  /**
   * Roles for which this feature can be toggled. OWNER is always excluded.
   * As of Task 17, all non-OWNER roles can be granted any feature — the
   * owner decides what each employee can access. The `appliesTo` field is
   * kept for backward compatibility and as a "default suggestion" hint.
   */
  appliesTo: ('MANAGER' | 'DRIVER' | 'PICKER')[]
  /** Group for UI categorization. */
  group: 'Admin' | 'Driver' | 'Picker'
}

/** All non-OWNER employee roles. Used so the catalog can grant any feature to any employee. */
const ALL_EMPLOYEE_ROLES: ('MANAGER' | 'DRIVER' | 'PICKER')[] = ['MANAGER', 'DRIVER', 'PICKER']

export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  // ─── Admin-area features ──
  {
    key: 'admin_dashboard',
    label: 'Admin Dashboard',
    description: 'View the main admin dashboard with KPIs and recent orders.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'kanban',
    label: 'Order Kanban Board',
    description: 'View and use the kanban-style order management board.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'orders',
    label: 'Order Management',
    description: 'View, edit, and update orders. Includes the kanban board.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'products',
    label: 'Products',
    description: 'Add, edit, delete, and manage inventory for products.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'categories',
    label: 'Categories',
    description: 'Manage product categories and sub-categories.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'View the customer list and toggle customer active status.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'drivers',
    label: 'Drivers',
    description: 'View and manage driver profiles and verification.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'employees',
    label: 'Employees',
    description: 'View, create, and manage employee accounts.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'banners',
    label: 'Banners',
    description: 'Upload, edit, and manage promotional banners.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'shifts',
    label: 'Shifts',
    description: 'View and assign staff shifts.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'finance',
    label: 'Finance',
    description: 'View revenue, expenses, and finance reports.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'wastage',
    label: 'Wastage',
    description: 'Log and view product wastage reports.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'promotions',
    label: 'Promotions',
    description: 'Create and manage promotional discounts.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'delivery_zones',
    label: 'Delivery Zones',
    description: 'Configure delivery zones, fees, and minimum orders.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'View store performance analytics.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },
  {
    key: 'settings',
    label: 'Store Settings',
    description: 'Configure store profile, hours, and bank holiday mode.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Admin',
  },

  // ─── Driver-area features ──
  {
    key: 'driver_dashboard',
    label: 'Driver Dashboard',
    description: 'View active deliveries and driver home page.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Driver',
  },
  {
    key: 'driver_earnings',
    label: 'Driver Earnings',
    description: 'View earnings breakdown and history.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Driver',
  },
  {
    key: 'driver_profile',
    label: 'Driver Profile',
    description: 'View and edit driver profile and documents.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Driver',
  },

  // ─── Picker-area features ──
  {
    key: 'picker_dashboard',
    label: 'Picker Dashboard',
    description: 'View picking queue and picker home page.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Picker',
  },
  {
    key: 'picker_packing',
    label: 'Picker Packing',
    description: 'Access the packing workflow page.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Picker',
  },
  {
    key: 'picker_profile',
    label: 'Picker Profile',
    description: 'View and edit picker profile.',
    appliesTo: ALL_EMPLOYEE_ROLES,
    group: 'Picker',
  },
]

/**
 * Set of feature keys that belong to the "Admin" group.
 * Used by the admin layout to decide if a non-admin-role user (DRIVER/PICKER)
 * should be allowed into /admin/* — they're allowed in if they have any
 * admin feature enabled.
 */
export const ADMIN_GROUP_FEATURE_KEYS: Set<string> = new Set(
  FEATURE_CATALOG.filter((f) => f.group === 'Admin').map((f) => f.key)
)

/**
 * Check whether a feature key belongs to the admin group.
 */
export function isAdminFeatureKey(key: string): boolean {
  return ADMIN_GROUP_FEATURE_KEYS.has(key)
}

/**
 * Check whether a list of enabled features contains any admin-group feature.
 * Used to decide if a DRIVER/PICKER should be allowed into /admin/*.
 * `null` means full access → returns true.
 */
export function hasAnyAdminFeature(enabledFeatures: string[] | null): boolean {
  if (enabledFeatures === null) return true
  return enabledFeatures.some((k) => ADMIN_GROUP_FEATURE_KEYS.has(k))
}

export const ALL_FEATURE_KEYS: string[] = FEATURE_CATALOG.map((f) => f.key)

/**
 * Returns the set of feature keys enabled for the user.
 *
 *   - OWNER role: returns null (means "all features enabled").
 *   - No EmployeeFeaturePermission row: returns null (default open).
 *   - Row exists: returns the set of feature keys in the row.
 */
export async function getEnabledFeatures(
  userId: string,
  userRole: string
): Promise<Set<string> | null> {
  const role = (userRole || '').toUpperCase()
  // OWNER always has full access
  if (role === 'OWNER') return null

  try {
    const prisma = await getPrisma()
    const row = await prisma.employeeFeaturePermission.findUnique({
      where: { userId },
    })
    if (!row) return null // default open
    let keys: string[] = []
    try {
      keys = JSON.parse(row.features || '[]')
    } catch {
      keys = []
    }
    return new Set(keys.filter((k) => typeof k === 'string'))
  } catch {
    // Fail open if DB error — let the user in (better UX than locking everyone out)
    return null
  }
}

/**
 * Check whether a user has access to a specific feature.
 *
 *   - OWNER role: always true.
 *   - No permission row: always true (default open).
 *   - Permission row exists: true only if the feature key is in the list.
 */
export async function hasFeatureAccess(
  userId: string,
  userRole: string,
  featureKey: string
): Promise<boolean> {
  const enabled = await getEnabledFeatures(userId, userRole)
  if (enabled === null) return true
  return enabled.has(featureKey)
}

/**
 * Get the list of feature keys enabled for a user (as an array).
 * Returns null if the user has full access (no restrictions).
 */
export async function getEnabledFeaturesList(
  userId: string,
  userRole: string
): Promise<string[] | null> {
  const set = await getEnabledFeatures(userId, userRole)
  if (set === null) return null
  return Array.from(set)
}

/**
 * Set the feature list for a user. Pass null to remove the restriction
 * (giving the user full access again).
 */
export async function setEnabledFeatures(
  userId: string,
  features: string[] | null
): Promise<void> {
  const prisma = await getPrisma()
  if (features === null) {
    // Remove the row → default open
    await prisma.employeeFeaturePermission.deleteMany({ where: { userId } })
    return
  }
  const featuresJson = JSON.stringify(features)
  await prisma.employeeFeaturePermission.upsert({
    where: { userId },
    update: { features: featuresJson },
    create: { userId, features: featuresJson },
  })
}

// ─── Mapping helpers (used by admin shell & API guards) ──

/**
 * Map an admin route prefix to its required feature key.
 * Returns null if the route doesn't require a feature permission (e.g. /admin itself).
 */
export function getFeatureKeyForAdminRoute(pathname: string): string | null {
  // Dashboard / admin root — always allowed for any admin
  if (pathname === '/admin') return null

  const map: Record<string, string> = {
    '/admin/products': 'products',
    '/admin/categories': 'categories',
    '/admin/orders': 'orders',
    '/admin/customers': 'customers',
    '/admin/drivers': 'drivers',
    '/admin/employees': 'employees',
    '/admin/banners': 'banners',
    '/admin/shifts': 'shifts',
    '/admin/finance': 'finance',
    '/admin/wastage': 'wastage',
    '/admin/promotions': 'promotions',
    '/admin/delivery-zones': 'delivery_zones',
    '/admin/analytics': 'analytics',
    '/admin/settings': 'settings',
  }
  for (const prefix of Object.keys(map)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) {
      return map[prefix]
    }
  }
  return null
}

/**
 * Map a driver route to its required feature key.
 */
export function getFeatureKeyForDriverRoute(pathname: string): string | null {
  if (pathname === '/driver' || pathname.startsWith('/driver/orders')) return 'driver_dashboard'
  if (pathname.startsWith('/driver/earnings')) return 'driver_earnings'
  if (pathname.startsWith('/driver/profile')) return 'driver_profile'
  return null
}

/**
 * Map a picker route to its required feature key.
 */
export function getFeatureKeyForPickerRoute(pathname: string): string | null {
  if (pathname === '/picker') return 'picker_dashboard'
  if (pathname.startsWith('/picker/packing')) return 'picker_packing'
  if (pathname.startsWith('/picker/profile')) return 'picker_profile'
  return null
}

/**
 * Map an admin API route prefix to its required feature key.
 * Used by API guards to enforce feature permissions server-side.
 */
export function getFeatureKeyForAdminApiRoute(pathname: string): string | null {
  // Strip the /api prefix and the /api/admin prefix
  if (!pathname.startsWith('/api/admin')) return null
  const after = pathname.replace(/^\/api\/admin/, '')
  const map: Record<string, string> = {
    '/products': 'products',
    '/categories': 'categories',
    '/orders': 'orders',
    '/customers': 'customers',
    '/drivers': 'drivers',
    '/employees': 'employees',
    '/banners': 'banners',
    '/shifts': 'shifts',
    '/finance': 'finance',
    '/wastage': 'wastage',
    '/promotions': 'promotions',
    '/delivery-zones': 'delivery_zones',
    '/delivery-map': 'delivery_zones',
    '/analytics': 'analytics',
    '/settings': 'settings',
    '/store': 'settings',
    '/bank-holidays': 'settings',
    '/expenses': 'finance',
  }
  // Sort keys by length descending so longer prefixes match first
  const keys = Object.keys(map).sort((a, b) => b.length - a.length)
  for (const prefix of keys) {
    if (after === prefix || after.startsWith(prefix + '/') || after.startsWith(prefix + '?')) {
      return map[prefix]
    }
  }
  return null
}

/**
 * Map a driver/picker API route to its required feature key.
 */
export function getFeatureKeyForEmployeeApiRoute(pathname: string): string | null {
  if (pathname.startsWith('/api/driver')) {
    if (pathname.startsWith('/api/driver/earnings')) return 'driver_earnings'
    if (pathname.startsWith('/api/driver/profile')) return 'driver_profile'
    return 'driver_dashboard'
  }
  if (pathname.startsWith('/api/picker')) {
    if (pathname.startsWith('/api/picker/profile')) return 'picker_profile'
    if (pathname.startsWith('/api/picker/packing') || pathname.startsWith('/api/picker/orders')) return 'picker_packing'
    return 'picker_dashboard'
  }
  return null
}

// ─── Inline Guards for Driver/Picker API Routes ──────────────
// These wrap the typical role check + feature check pattern used
// by /api/driver/* and /api/picker/* routes.
//
// Note: We deliberately do NOT annotate the return type so TypeScript
// can infer the discriminated union — when `error` is null, `user`
// is non-null (ServerUser). This avoids TS18047 errors at call sites.

interface EmployeeGuardOptions {
  /** If set, the user must have this feature enabled. */
  feature?: string
  /**
   * If set (and `feature` is not), the user must have AT LEAST ONE of these
   * features enabled. Useful for endpoints that span multiple features
   * (e.g. /api/picker/orders is used by both picker_dashboard and picker_packing).
   */
  anyOf?: string[]
}

/**
 * Check whether a user has a given role, considering BOTH their primary
 * `role` field AND any secondary roles stored in `additionalRoles`
 * (a JSON-encoded string array of Role enum values on the User row).
 *
 * This is what enables "dual-role" employees — e.g. one person can be
 * both a PICKER (primary) and a DRIVER (additional), and access both
 * /api/picker/* and /api/driver/* routes.
 *
 * OWNER and MANAGER always pass (they're admins with full access).
 */
async function userHasRole(userId: string, primaryRole: string, targetRole: 'DRIVER' | 'PICKER' | 'MANAGER'): Promise<boolean> {
  const upper = primaryRole.toUpperCase()
  // OWNER always passes (admins have full access to all routes)
  if (upper === 'OWNER') return true
  // Primary role matches target → pass
  if (upper === targetRole) return true
  // MANAGER primary always passes for any employee-target route
  // (managers have admin-level access to driver/picker endpoints too)
  if (upper === 'MANAGER') return true

  // Otherwise check additionalRoles — e.g. a PICKER who also has DRIVER in
  // their additionalRoles array should be allowed to access /api/driver/*.
  try {
    const prisma = await getPrisma()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { additionalRoles: true },
    })
    if (!user?.additionalRoles) return false
    try {
      const roles: string[] = JSON.parse(user.additionalRoles)
      return roles.some((r) => r.toUpperCase() === targetRole)
    } catch {
      return false
    }
  } catch (err) {
    console.error('[feature-permissions] userHasRole DB lookup failed:', err)
    return false
  }
}

/**
 * Guard for /api/driver/* routes.
 * Verifies: user is authenticated, has DRIVER role (either as primary
 * or as an additional role), and has the specified feature enabled (if any).
 *
 * Usage:
 *   const { error, user } = await requireDriver({ feature: 'driver_earnings' })
 *   if (error) return error
 *   // ... use user.id  (TS knows user is non-null here)
 *
 *   // OR-logic — user must have any one of these features:
 *   const { error, user } = await requireDriver({ anyOf: ['driver_dashboard', 'driver_earnings'] })
 */
export async function requireDriver(options?: EmployeeGuardOptions) {
  const user = await getServerUser()
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      user: null,
    } as const
  }
  const hasDriverRole = await userHasRole(user.id, user.role, 'DRIVER')
  if (!hasDriverRole) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — driver role required' },
        { status: 403 }
      ),
      user: null,
    } as const
  }
  if (options?.feature) {
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
      } as const
    }
  } else if (options?.anyOf && options.anyOf.length > 0) {
    const checks = await Promise.all(
      options.anyOf.map((f) => hasFeatureAccess(user.id, user.role, f))
    )
    if (!checks.some(Boolean)) {
      return {
        error: NextResponse.json(
          {
            error: 'Access denied — none of the required features are enabled for your account.',
            code: 'FEATURE_NOT_ENABLED',
            requiredAnyOf: options.anyOf,
          },
          { status: 403 }
        ),
        user: null,
      } as const
    }
  }
  return { error: null, user } as const
}

/**
 * Guard for /api/picker/* routes.
 * Verifies: user is authenticated, has PICKER role (either as primary
 * or as an additional role), and has the specified feature enabled (if any).
 *
 * Usage:
 *   const { error, user } = await requirePicker({ feature: 'picker_packing' })
 *
 *   // OR-logic — user must have any one of these features:
 *   const { error, user } = await requirePicker({ anyOf: ['picker_dashboard', 'picker_packing'] })
 */
export async function requirePicker(options?: EmployeeGuardOptions) {
  const user = await getServerUser()
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      user: null,
    } as const
  }
  const hasPickerRole = await userHasRole(user.id, user.role, 'PICKER')
  if (!hasPickerRole) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — picker role required' },
        { status: 403 }
      ),
      user: null,
    } as const
  }
  if (options?.feature) {
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
      } as const
    }
  } else if (options?.anyOf && options.anyOf.length > 0) {
    const checks = await Promise.all(
      options.anyOf.map((f) => hasFeatureAccess(user.id, user.role, f))
    )
    if (!checks.some(Boolean)) {
      return {
        error: NextResponse.json(
          {
            error: 'Access denied — none of the required features are enabled for your account.',
            code: 'FEATURE_NOT_ENABLED',
            requiredAnyOf: options.anyOf,
          },
          { status: 403 }
        ),
        user: null,
      } as const
    }
  }
  return { error: null, user } as const
}
