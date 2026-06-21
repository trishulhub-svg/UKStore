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
  /** Roles for which this feature can be toggled. OWNER is always excluded. */
  appliesTo: ('MANAGER' | 'DRIVER' | 'PICKER')[]
  /** Group for UI categorization. */
  group: 'Admin' | 'Driver' | 'Picker'
}

export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  // ─── Admin-area features (toggled for MANAGER, sometimes DRIVER/PICKER) ──
  {
    key: 'admin_dashboard',
    label: 'Admin Dashboard',
    description: 'View the main admin dashboard with KPIs and recent orders.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'kanban',
    label: 'Order Kanban Board',
    description: 'View and use the kanban-style order management board.',
    appliesTo: ['MANAGER', 'DRIVER', 'PICKER'],
    group: 'Admin',
  },
  {
    key: 'orders',
    label: 'Order Management',
    description: 'View, edit, and update orders. Includes the kanban board.',
    appliesTo: ['MANAGER', 'DRIVER', 'PICKER'],
    group: 'Admin',
  },
  {
    key: 'products',
    label: 'Products',
    description: 'Add, edit, delete, and manage inventory for products.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'categories',
    label: 'Categories',
    description: 'Manage product categories and sub-categories.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'View the customer list and toggle customer active status.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'drivers',
    label: 'Drivers',
    description: 'View and manage driver profiles and verification.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'employees',
    label: 'Employees',
    description: 'View, create, and manage employee accounts.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'banners',
    label: 'Banners',
    description: 'Upload, edit, and manage promotional banners.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'shifts',
    label: 'Shifts',
    description: 'View and assign staff shifts.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'finance',
    label: 'Finance',
    description: 'View revenue, expenses, and finance reports.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'wastage',
    label: 'Wastage',
    description: 'Log and view product wastage reports.',
    appliesTo: ['MANAGER', 'PICKER'],
    group: 'Admin',
  },
  {
    key: 'promotions',
    label: 'Promotions',
    description: 'Create and manage promotional discounts.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'delivery_zones',
    label: 'Delivery Zones',
    description: 'Configure delivery zones, fees, and minimum orders.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'View store performance analytics.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },
  {
    key: 'settings',
    label: 'Store Settings',
    description: 'Configure store profile, hours, and bank holiday mode.',
    appliesTo: ['MANAGER'],
    group: 'Admin',
  },

  // ─── Driver-area features ──
  {
    key: 'driver_dashboard',
    label: 'Driver Dashboard',
    description: 'View active deliveries and driver home page.',
    appliesTo: ['DRIVER'],
    group: 'Driver',
  },
  {
    key: 'driver_earnings',
    label: 'Driver Earnings',
    description: 'View earnings breakdown and history.',
    appliesTo: ['DRIVER'],
    group: 'Driver',
  },
  {
    key: 'driver_profile',
    label: 'Driver Profile',
    description: 'View and edit driver profile and documents.',
    appliesTo: ['DRIVER'],
    group: 'Driver',
  },

  // ─── Picker-area features ──
  {
    key: 'picker_dashboard',
    label: 'Picker Dashboard',
    description: 'View picking queue and picker home page.',
    appliesTo: ['PICKER'],
    group: 'Picker',
  },
  {
    key: 'picker_packing',
    label: 'Picker Packing',
    description: 'Access the packing workflow page.',
    appliesTo: ['PICKER'],
    group: 'Picker',
  },
  {
    key: 'picker_profile',
    label: 'Picker Profile',
    description: 'View and edit picker profile.',
    appliesTo: ['PICKER'],
    group: 'Picker',
  },
]

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

/**
 * Guard for /api/driver/* routes.
 * Verifies: user is authenticated, has DRIVER role, and has the
 * specified feature enabled (if any).
 *
 * Usage:
 *   const { error, user } = await requireDriver({ feature: 'driver_earnings' })
 *   if (error) return error
 *   // ... use user.id  (TS knows user is non-null here)
 */
export async function requireDriver(options?: { feature?: string }) {
  const user = await getServerUser()
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      user: null,
    } as const
  }
  if (user.role.toUpperCase() !== 'DRIVER') {
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
  }
  return { error: null, user } as const
}

/**
 * Guard for /api/picker/* routes.
 * Verifies: user is authenticated, has PICKER role, and has the
 * specified feature enabled (if any).
 */
export async function requirePicker(options?: { feature?: string }) {
  const user = await getServerUser()
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      user: null,
    } as const
  }
  if (user.role.toUpperCase() !== 'PICKER') {
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
  }
  return { error: null, user } as const
}
