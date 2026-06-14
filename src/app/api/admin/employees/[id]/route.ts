import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'

// PATCH /api/admin/employees/[id] — update employee salary/wage info
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { id } = await params
    const body = await request.json()

    // Verify user exists and is not a customer
    const user = await prisma.user.findFirst({
      where: { id, role: { in: ['DRIVER', 'PICKER', 'OWNER', 'MANAGER'] } },
    })
    if (!user) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Get or create employee profile
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
      profile = await prisma.employeeProfile.update({
        where: { userId: id },
        data: profileData,
      })
    } else {
      profile = await prisma.employeeProfile.create({
        data: {
          userId: id,
          ...profileData,
        },
      })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[Admin Employee PATCH]', err)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}
