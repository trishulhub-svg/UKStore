// ============================================================
// Role utilities — Edge-compatible (no Node.js dependencies)
// Used by middleware, auth-client, and other edge contexts
// ============================================================

/**
 * Parse a user's `additionalRoles` JSON string (stored on the User row)
 * into a clean lowercase array. Returns [] on parse failure or empty input.
 *
 * Example: '["DRIVER","MANAGER"]' → ['driver', 'manager']
 */
export function parseAdditionalRoles(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((r: unknown) => (typeof r === 'string' ? r.toLowerCase().trim() : ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Determine the correct dashboard URL for a user based on their role.
 * Used after login to redirect admin/driver users to the right place.
 * Role is case-insensitive.
 *
 * NOTE: This function considers ONLY the primary role. For users with
 * dual roles (primary + additionalRoles), use `getRoleBasedRedirectFromRoles`
 * instead, which picks the most privileged destination.
 */
export function getRoleBasedRedirect(role: string): string {
  const r = (role || '').toLowerCase().trim()

  if (r === 'owner' || r === 'manager') {
    return '/admin'
  }

  if (r === 'driver') {
    return '/driver'
  }

  if (r === 'picker') {
    return '/picker'
  }

  // Default: customer goes to home page
  return '/'
}

/**
 * Determine the correct dashboard URL for a user based on their primary
 * role AND any additional roles they hold (dual-role support).
 *
 * Role priority (highest wins):
 *   1. OWNER or MANAGER (anywhere) → /admin
 *   2. DRIVER (anywhere)            → /driver
 *   3. PICKER (anywhere)            → /picker
 *   4. otherwise                     → /
 *
 * This fixes the bug where a user with primary role PICKER but
 * additionalRoles including MANAGER would be sent to /picker on login
 * instead of /admin. With this function, the MANAGER additional role
 * takes precedence and sends them to /admin.
 *
 * @param primaryRole     The user's primary role (User.role field)
 * @param additionalRoles The user's additional roles (parsed from User.additionalRoles JSON)
 */
export function getRoleBasedRedirectFromRoles(
  primaryRole: string,
  additionalRoles: string[] = [],
): string {
  const allRoles = [
    (primaryRole || '').toLowerCase().trim(),
    ...additionalRoles.map((r) => (r || '').toLowerCase().trim()),
  ].filter(Boolean)

  // Admin (OWNER / MANAGER) wins — never send an admin to a picker/driver dashboard
  if (allRoles.some((r) => r === 'owner' || r === 'manager')) {
    return '/admin'
  }

  if (allRoles.some((r) => r === 'driver')) {
    return '/driver'
  }

  if (allRoles.some((r) => r === 'picker')) {
    return '/picker'
  }

  return '/'
}

/**
 * Check if a role is an admin role (owner or manager).
 */
export function isAdminRole(role: string): boolean {
  const r = (role || '').toLowerCase().trim()
  return r === 'owner' || r === 'manager'
}

/**
 * Check if a user is an admin, considering BOTH their primary role AND
 * any additional roles. Returns true if any of their roles is OWNER or MANAGER.
 *
 * Use this in middleware / route guards to decide if a user should be
 * allowed into /admin/* (and never redirected away to /picker or /driver).
 */
export function isAdminWithAdditionalRoles(
  primaryRole: string,
  additionalRoles: string[] = [],
): boolean {
  if (isAdminRole(primaryRole)) return true
  return additionalRoles.some((r) => isAdminRole(r))
}

/**
 * Check if a role is a driver/picker role.
 */
export function isDriverRole(role: string): boolean {
  const r = (role || '').toLowerCase().trim()
  return r === 'driver' || r === 'picker'
}

/**
 * Check if a role is a valid known role.
 */
export function isValidRole(role: string): boolean {
  const r = (role || '').toLowerCase().trim()
  return ['owner', 'manager', 'driver', 'picker', 'customer'].includes(r)
}
