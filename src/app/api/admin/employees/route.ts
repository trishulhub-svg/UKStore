import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/employees — list all non-customer users with employee profiles and today's order counts
export async function GET() {
  const { error } = await requireAdmin()
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
