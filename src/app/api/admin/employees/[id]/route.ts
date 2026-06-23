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
