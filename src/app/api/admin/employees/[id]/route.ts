import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

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
  const { error, user } = await requireAdmin()
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

    return NextResponse.json({ profile, user: userUpdates })
  } catch (err) {
    console.error('[Admin Employee PATCH]', err)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}
