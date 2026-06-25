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
 * **Primary role wins.** A user whose primary role is PICKER always
 * goes to /picker — even if they have MANAGER in additionalRoles or
 * have admin feature permissions enabled. Same for DRIVER → /driver.
 * This is by design: your primary role is your "main job", and your
 * login landing page should reflect that. Admin features you've been
 * granted are linked from your own dashboard, not a redirect to /admin.
 *
 * For CUSTOMER primary role, we DO check additional roles — e.g. a
 * customer who is also a picker should go to /picker to do their job.
 *
 * @param primaryRole     The user's primary role (User.role field)
 * @param additionalRoles The user's additional roles (parsed from User.additionalRoles JSON)
 */
export function getRoleBasedRedirectFromRoles(
  primaryRole: string,
  additionalRoles: string[] = [],
): string {
  const primary = (primaryRole || '').toLowerCase().trim()

  // ─── Primary role determines the destination ───────────────────
  // Picker/driver ALWAYS go to their own dashboard. They can still
  // access /admin/<feature> pages via direct links in their dashboard
  // menu (if they have admin features), but their login landing page
  // is their primary role's dashboard — never /admin.
  if (primary === 'owner' || primary === 'manager') {
    return '/admin'
  }

  if (primary === 'driver') {
    return '/driver'
  }

  if (primary === 'picker') {
    return '/picker'
  }

  // ─── Customer fallback: check additional roles ─────────────────
  // A customer might also be an employee (dual role). If so, send
  // them to their employee dashboard so they can start working.
  const additional = (additionalRoles || [])
    .map((r) => (r || '').toLowerCase().trim())
    .filter(Boolean)

  if (additional.some((r) => r === 'owner' || r === 'manager')) {
    return '/admin'
  }

  if (additional.includes('driver')) {
    return '/driver'
  }

  if (additional.includes('picker')) {
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
 * Check if a user is an admin, considering BOTH their primary role AND
 * any additional roles. Returns true if any of their roles is OWNER or MANAGER.
 *
 * NOTE: This is used for SECURITY checks (e.g. "can this user access
 * /admin at all?"), NOT for login redirect. The login redirect uses
 * `getRoleBasedRedirectFromRoles` which is primary-role-based — a
 * picker with MANAGER additional role still lands on /picker, but
 * they ARE an admin for access-control purposes and can navigate to
 * /admin via URL if they have admin features enabled.
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
