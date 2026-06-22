import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { hashPassword } from '@/lib/auth'
import { setEnabledFeatures } from '@/lib/feature-permissions'
import crypto from 'crypto'

/**
 * Generate a secure random temporary password.
 * 12 chars: mix of upper/lower/digits/symbols — meets typical complexity rules.
 */
function generateTempPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*-_=+'
  const all = upper + lower + digits + symbols
  // Ensure at least one of each category
  const required = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ]
  const remaining: string[] = []
  for (let i = 0; i < length - required.length; i++) {
    remaining.push(all[crypto.randomInt(all.length)])
  }
  // Combine and shuffle
  const combined = [...required, ...remaining]
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[combined[i], combined[j]] = [combined[j], combined[i]]
  }
  return combined.join('')
}

// GET /api/admin/employees — list all non-customer users with employee profiles and today's order counts
export async function GET() {
  const { error } = await requireAdmin({ feature: 'employees' })
  if (error) return error

  try {
    const prisma = await getPrisma()

    // Get all non-customer users
    const employees = await prisma.user.findMany({
      where: {
        role: { in: ['DRIVER', 'PICKER', 'OWNER', 'MANAGER'] },
      },
      include: {
        employeeProfile: true,
        driverProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate today's order counts
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const employeeData = await Promise.all(
      employees.map(async (emp) => {
        let todayOrderCount = 0

        try {
          if (emp.role === 'DRIVER') {
            // Count delivered orders today where this user is the driver
            todayOrderCount = await prisma.order.count({
              where: {
                driverId: emp.id,
                status: 'delivered',
                deliveredAt: { gte: todayStart },
              },
            })
          } else if (emp.role === 'PICKER') {
            // Count packed orders today (packedAt today)
            todayOrderCount = await prisma.order.count({
              where: {
                status: { in: ['picking', 'ready', 'out_for_delivery', 'delivered'] },
                packedAt: { gte: todayStart },
                // We don't have a direct pickerId field, so we count orders packed today
                // that are from this store. This is a best-effort approach.
              },
            })
          }
        } catch {
          // Non-critical
        }

        return {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          role: emp.role,
          isActive: emp.isActive,
          mustResetPassword: emp.mustResetPassword,
          createdAt: emp.createdAt.toISOString(),
          employeeProfile: emp.employeeProfile
            ? {
                id: emp.employeeProfile.id,
                salary: emp.employeeProfile.salary,
                wageRate: emp.employeeProfile.wageRate,
                wageType: emp.employeeProfile.wageType,
                bankName: emp.employeeProfile.bankName,
                bankAccountNo: emp.employeeProfile.bankAccountNo,
                bankSortCode: emp.employeeProfile.bankSortCode,
              }
            : null,
          driverProfile: emp.driverProfile
            ? {
                vehicleType: emp.driverProfile.vehicleType,
                verificationStatus: emp.driverProfile.verificationStatus,
              }
            : null,
          todayOrderCount,
        }
      })
    )

    return NextResponse.json({ employees: employeeData })
  } catch (err) {
    console.error('[Admin Employees GET]', err)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

/**
 * POST /api/admin/employees — create a new employee account.
 *
 * Body:
 *   - name: string (required)
 *   - email: string (required, unique)
 *   - phone?: string
 *   - role: 'DRIVER' | 'PICKER' | 'MANAGER' (required, OWNER not allowed via this endpoint)
 *   - tempPassword?: string (optional, auto-generated if omitted)
 *
 * The created user is hashed with bcrypt, mustResetPassword=true so they're forced
 * to set their own password on first login. The temp password is returned ONCE
 * for the admin to share with the employee (we don't have SMTP configured by default).
 *
 * If an SMTP-enabled email service is wired up later, we'd send the temp password
 * to the employee's email automatically.
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin({ feature: 'employees' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()

    // Validate required fields
    const { name, email, role, phone, tempPassword, features } = body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    const allowedRoles = ['DRIVER', 'PICKER', 'MANAGER']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${allowedRoles.join(', ')}` },
        { status: 400 }
      )
    }
    // Validate features payload if provided
    // - null/undefined = full access (default)
    // - string[] = restricted to listed features
    let featuresToSet: string[] | null = null
    if (features !== undefined && features !== null) {
      if (!Array.isArray(features) || !features.every((f: unknown) => typeof f === 'string')) {
        return NextResponse.json({ error: 'features must be an array of strings or null' }, { status: 400 })
      }
      featuresToSet = features as string[]
    }

    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }

    // Use provided temp password or generate a secure one
    const finalTempPassword =
      typeof tempPassword === 'string' && tempPassword.length >= 8
        ? tempPassword
        : generateTempPassword()

    const passwordHash = await hashPassword(finalTempPassword)

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name.trim(),
        phone: phone || null,
        role,
        passwordHash,
        isActive: true,
        mustResetPassword: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        mustResetPassword: true,
        createdAt: true,
      },
    })

    // For drivers, also create a default driver profile with pending verification
    if (role === 'DRIVER') {
      await prisma.driverProfile.create({
        data: {
          userId: newUser.id,
          verificationStatus: 'pending',
        },
      })
    }

    // Create an empty employee profile so salary/wage can be edited later
    await prisma.employeeProfile.create({
      data: { userId: newUser.id },
    })

    // Apply feature permissions if provided (null = full access, string[] = restricted)
    // Only applies to non-OWNER roles (which is enforced above by allowedRoles).
    if (featuresToSet !== null || features !== undefined) {
      try {
        await setEnabledFeatures(newUser.id, featuresToSet)
      } catch (permErr) {
        // Non-fatal — the user is created, just log the permission error
        console.error('[Admin Employees POST] Failed to set feature permissions:', permErr)
      }
    }

    // TODO: When SMTP is configured (Resend/SendGrid), send the temp password
    //       to newUser.email here. For now, return it once so the admin can
    //       share it manually.
    // await sendTempPasswordEmail(newUser.email, finalTempPassword)

    console.log(`[Admin Employees POST] Owner ${user.id} created ${role} account ${newUser.email}`)

    return NextResponse.json(
      {
        employee: newUser,
        tempPassword: finalTempPassword,
        emailSent: false, // Flip to true when SMTP is wired
        message: 'Employee created. Share the temp password — they must reset it on first login.',
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[Admin Employees POST]', err)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
