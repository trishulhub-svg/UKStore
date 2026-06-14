import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// GET /api/admin/attendance — get all attendance logs (admin)
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const role = user.role.toLowerCase()
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const employeeId = searchParams.get('employeeId')

    const where: any = {}

    if (employeeId) {
      where.userId = employeeId
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setDate(end.getDate() + 1) // include the end date
        where.createdAt.lt = end
      }
    }

    const logs = await prisma.attendanceLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    // Get all staff members for filter dropdown
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ['DRIVER', 'PICKER', 'MANAGER', 'OWNER'] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    })

    // Determine who is currently clocked in
    const currentlyClockedIn: string[] = []
    for (const s of staff) {
      const lastLog = await prisma.attendanceLog.findFirst({
        where: { userId: s.id },
        orderBy: { createdAt: 'desc' },
      })
      if (lastLog?.type === 'clock_in') {
        currentlyClockedIn.push(s.id)
      }
    }

    // Pair clock_in and clock_out logs for timesheet display
    const pairedLogs: any[] = []
    const clockIns = logs.filter((l) => l.type === 'clock_in')

    for (const clockIn of clockIns) {
      const clockOut = logs.find(
        (l) =>
          l.type === 'clock_out' &&
          l.userId === clockIn.userId &&
          new Date(l.createdAt) > new Date(clockIn.createdAt)
      )

      const duration = clockOut
        ? new Date(clockOut.createdAt).getTime() - new Date(clockIn.createdAt).getTime()
        : Date.now() - new Date(clockIn.createdAt).getTime()

      pairedLogs.push({
        id: clockIn.id,
        userId: clockIn.userId,
        userName: clockIn.user.name || clockIn.user.email,
        userRole: clockIn.user.role,
        clockInTime: clockIn.createdAt.toISOString(),
        clockOutTime: clockOut ? clockOut.createdAt.toISOString() : null,
        duration,
        ipAddress: clockIn.ipAddress,
        isActive: !clockOut,
      })
    }

    return NextResponse.json({
      logs: pairedLogs,
      staff,
      currentlyClockedIn,
    })
  } catch (err) {
    console.error('[Admin Attendance GET]', err)
    return NextResponse.json({ error: 'Failed to fetch attendance logs' }, { status: 500 })
  }
}
