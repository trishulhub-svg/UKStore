import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { setEnabledFeatures } from '@/lib/feature-permissions'

/**
 * PATCH /api/admin/employees/[id]
 *
 * Updates employee salary/wage info AND/OR profile fields (name, phone, email, isActive, role).
 *
 * Field-level permissions:
 *   - OWNER role can change: name, phone, email, role, isActive, salary fields
 *   - MANAGER role can change: name, phone, salary fields
 *   - Email changes are OWNER-only (managers cannot change emails)
 *   - Role changes are OWNER-only
 *
 * Self-edit (when id === user.id) also allowed for name/phone — useful for
 * the owner editing their own profile from this page.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAdmin({ feature: 'employees' })
  if (error) return error

  const isOwner = user.role === 'OWNER'

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()

    // Verify user exists and is not a customer
    const targetUser = await prisma.user.findFirst({
      where: { id, role: { in: ['DRIVER', 'PICKER', 'OWNER', 'MANAGER'] } },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // ─── User-level field updates ──────────────────────────────
    const userUpdates: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      userUpdates.name = body.name.trim()
    }
    if (typeof body.phone === 'string') {
      userUpdates.phone = body.phone.trim() || null
    }

    // Email change — OWNER only
    if (typeof body.email === 'string' && body.email.trim()) {
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only the store owner can change email addresses' },
          { status: 403 }
        )
      }
      const newEmail = body.email.toLowerCase().trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
      // Check uniqueness (excluding the current user)
      const emailOwner = await prisma.user.findUnique({ where: { email: newEmail } })
      if (emailOwner && emailOwner.id !== id) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      userUpdates.email = newEmail
    }

    // Role change — OWNER only
    if (typeof body.role === 'string' && ['DRIVER', 'PICKER', 'MANAGER'].includes(body.role)) {
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only the store owner can change employee roles' },
          { status: 403 }
        )
      }
      // Don't allow demoting yourself (would lock yourself out)
      if (id === user.id) {
        return NextResponse.json(
          { error: 'You cannot change your own role' },
          { status: 400 }
        )
      }
      userUpdates.role = body.role
    }

    // additionalRoles — OWNER only.
    // Accept either:
    //   - null / undefined → no change
    //   - array of strings (e.g. ['DRIVER']) → set exactly those roles
    //   - empty array → clear all additional roles
    // We sanitize to UPPERCASE and filter to the allowed employee role set,
    // and we strip out the user's primary role (it's already in `role`).
    // This is what enables "dual-role" employees — e.g. a PICKER who is
    // also allowed to drive.
    if (body.additionalRoles !== undefined) {
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only the store owner can change additional roles' },
          { status: 403 }
        )
      }
      const incoming = body.additionalRoles
      if (!Array.isArray(incoming)) {
        return NextResponse.json(
          { error: 'additionalRoles must be an array of strings' },
          { status: 400 }
        )
      }
      const validRoles = new Set(['DRIVER', 'PICKER', 'MANAGER'])
      const primaryRole = (typeof body.role === 'string' ? body.role : targetUser.role).toUpperCase()
      const cleaned: string[] = Array.from(new Set(
        incoming
          .map((r: unknown) => (typeof r === 'string' ? r.toUpperCase().trim() : ''))
          .filter((r: string) => validRoles.has(r) && r !== primaryRole)
      ))
      userUpdates.additionalRoles = JSON.stringify(cleaned)
    }

    // isActive toggle — OWNER only
    if (typeof body.isActive === 'boolean') {
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only the store owner can activate/deactivate employees' },
          { status: 403 }
        )
      }
      if (id === user.id && body.isActive === false) {
        return NextResponse.json(
          { error: 'You cannot deactivate your own account' },
          { status: 400 }
        )
      }
      userUpdates.isActive = body.isActive
    }

    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({ where: { id }, data: userUpdates })
    }

    // ─── Employee profile updates (salary, wage, bank details) ──
    let profile = await prisma.employeeProfile.findUnique({
      where: { userId: id },
    })

    const profileData: Record<string, unknown> = {}
    if (body.salary !== undefined) profileData.salary = parseFloat(body.salary) || null
    if (body.wageRate !== undefined) profileData.wageRate = parseFloat(body.wageRate) || null
    if (body.wageType !== undefined) profileData.wageType = body.wageType || null
    if (body.bankName !== undefined) profileData.bankName = body.bankName || null
    if (body.bankAccountNo !== undefined) profileData.bankAccountNo = body.bankAccountNo || null
    if (body.bankSortCode !== undefined) profileData.bankSortCode = body.bankSortCode || null

    if (profile) {
      if (Object.keys(profileData).length > 0) {
        profile = await prisma.employeeProfile.update({
          where: { userId: id },
          data: profileData,
        })
      }
    } else {
      profile = await prisma.employeeProfile.create({
        data: {
          userId: id,
          ...profileData,
        },
      })
    }

    // ─── Feature permissions update ────────────────────────────
    // If body.features is provided, update the employee's feature permission row.
    //   - null = full access (removes the restriction row)
    //   - string[] = restricted to listed features
    // OWNER users cannot be restricted — the helper enforces this, but we also
    // double-check here to be safe.
    if (body.features !== undefined && targetUser.role !== 'OWNER') {
      let featuresToSet: string[] | null = null
      if (body.features !== null) {
        if (!Array.isArray(body.features) || !body.features.every((f: unknown) => typeof f === 'string')) {
          return NextResponse.json({ error: 'features must be an array of strings or null' }, { status: 400 })
        }
        featuresToSet = body.features as string[]
      }
      try {
        await setEnabledFeatures(id, featuresToSet)
      } catch (permErr) {
        console.error('[Admin Employee PATCH] Failed to set feature permissions:', permErr)
        // Non-fatal — other updates succeeded
      }
    }

    return NextResponse.json({ profile, user: userUpdates })
  } catch (err) {
    console.error('[Admin Employee PATCH]', err)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/employees/[id]
 *
 * Removes an employee from the active staff list. OWNER-only.
 *
 * We use a SOFT-DELETE-with-anonymisation strategy instead of a hard
 * SQL DELETE, because the user may be referenced by audit trails
 * (OrderStatusLog.changedById) and historical orders (Order.driverId).
 * Hard-deleting the row would either fail (FK constraint) or destroy
 * the audit trail. Instead, we:
 *
 *   1. Scrub PII (name, phone, passwordHash, avatarUrl, additionalRoles)
 *      so the user can never log in or be identified.
 *   2. Replace the email with a unique anonymised placeholder so the
 *      original email is freed up for re-use (e.g. if the employee is
 *      re-hired). Format: deleted-<timestamp>-<random>@anonymised.local
 *   3. Set isActive = false (so they don't appear in active staff lists).
 *   4. Revoke ALL active sessions (delete Session rows) — instant logout.
 *   5. Delete DriverProfile, EmployeeProfile, EmployeeFeaturePermission
 *      rows (these cascade anyway, but we're explicit for clarity).
 *   6. Null out Order.driverId for any orders currently assigned to this
 *      driver so those orders aren't "stuck" on a deleted user. Historical
 *      orders (status = delivered / cancelled / etc.) keep the driverId
 *      for record-keeping — we only null it on active orders.
 *
 * Guard rails:
 *   - Cannot delete yourself (id === user.id) — would lock yourself out.
 *   - Cannot delete another OWNER — must transfer ownership first
 *     (not implemented; requires a separate ownership-transfer flow).
 *   - MANAGER cannot delete anyone — OWNER-only, full stop.
 *
 * Returns: { success: true, anonymisedEmail: string }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // OWNER-only — managers can deactivate (via PATCH) but cannot delete.
  // This is a deliberate permission boundary: deletion is irreversible
  // (anonymisation can't be undone), so only the highest authority can do it.
  const { error, user } = await requireAdmin()
  if (error) return error

  if (user.role.toUpperCase() !== 'OWNER') {
    return NextResponse.json(
      { error: 'Only the store owner can delete employees. Managers may deactivate instead.' },
      { status: 403 }
    )
  }

  try {
    const prisma = await getPrisma()
    const { id } = await params

    // Look up the target user
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Only allow deleting staff (DRIVER / PICKER / MANAGER). Other owners
    // cannot be deleted via this endpoint — ownership transfer is a
    // separate (not-yet-implemented) flow.
    const role = targetUser.role.toUpperCase()
    if (!['DRIVER', 'PICKER', 'MANAGER'].includes(role)) {
      return NextResponse.json(
        { error: 'Only drivers, pickers, and managers can be deleted. Owners cannot be deleted via this endpoint.' },
        { status: 400 }
      )
    }

    // Guard: cannot delete yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 }
      )
    }

    // ─── Anonymise the user row ─────────────────────────────────
    // Use a timestamp + random suffix to guarantee uniqueness even if
    // the same email is deleted twice (shouldn't happen, but defends
    // against races). The placeholder is at @anonymised.local which is
    // a reserved TLD that will never resolve, so it can't be used to
    // actually send mail or log in.
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 10)
    const anonymisedEmail = `deleted-${ts}-${rand}@anonymised.local`

    // ─── Transaction: scrub PII + nullify active driver assignments ─
    // We do this in a transaction so we never end up in a half-deleted
    // state if one of the writes fails.
    await prisma.$transaction([
      // 1. Scrub the user row. passwordHash → null means they can never
      //    log in with any password (the login API rejects users with
      //    no passwordHash). additionalRoles → "[]" clears dual-role
      //    privileges. avatarUrl → null removes any uploaded photo ref.
      prisma.user.update({
        where: { id },
        data: {
          email: anonymisedEmail,
          name: null,
          phone: null,
          passwordHash: null,
          avatarUrl: null,
          additionalRoles: '[]',
          isActive: false,
          mustResetPassword: false,
        },
      }),

      // 2. Revoke all active sessions (instant logout on every device).
      //    The Session table has onDelete: Cascade on the user relation,
      //    so this would happen automatically on hard-delete — but since
      //    we're soft-deleting, we need to do it explicitly.
      prisma.session.deleteMany({ where: { userId: id } }),

      // 3. Delete the driver profile (vehicle type, verification status).
      //    Cascade on the relation would handle this on hard-delete; we
      //    do it explicitly here for clarity.
      prisma.driverProfile.deleteMany({ where: { userId: id } }),

      // 4. Delete the employee profile (salary, wage, bank details).
      //    This is GDPR-sensitive data we should not retain after deletion.
      prisma.employeeProfile.deleteMany({ where: { userId: id } }),

      // 5. Delete the feature-permission row (so if this email is ever
      //    re-used for a new hire, they start with a clean slate).
      prisma.employeeFeaturePermission.deleteMany({ where: { userId: id } }),

      // 6. Null out Order.driverId for any ACTIVE orders (placed, picking,
      //    ready, out_for_delivery) currently assigned to this driver.
      //    Historical orders (delivered, cancelled, returned) keep the
      //    driverId for record-keeping so admins can still see who
      //    delivered what.
      prisma.order.updateMany({
        where: {
          driverId: id,
          status: { in: ['placed', 'picking', 'ready', 'out_for_delivery'] },
        },
        data: { driverId: null },
      }),
    ])

    return NextResponse.json({
      success: true,
      anonymisedEmail,
      message: `Employee "${targetUser.email}" has been deleted. Their account is deactivated, their PII has been scrubbed, and their sessions have been revoked. Active orders have been unassigned.`,
    })
  } catch (err) {
    console.error('[Admin Employee DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}
