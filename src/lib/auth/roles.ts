// ============================================================
// Role utilities — Edge-compatible (no Node.js dependencies)
// Used by middleware, auth-client, and other edge contexts
// ============================================================

/**
 * Determine the correct dashboard URL for a user based on their role.
 * Used after login to redirect admin/driver users to the right place.
 * Role is case-insensitive.
 *
 * NOTE: picker and driver are distinct destinations — pickers go to
 * /picker (the packing dashboard) and drivers go to /driver (the
 * delivery dashboard). If a user has BOTH roles (dual-role employee,
 * see User.additionalRoles), the caller should pass the primary role
 * (the one stored in User.role) — that's what determines the landing
 * page. The user can then navigate to the other dashboard manually.
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
 * Check if a role is an admin role (owner or manager).
 */
export function isAdminRole(role: string): boolean {
  const r = (role || '').toLowerCase().trim()
  return r === 'owner' || r === 'manager'
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
