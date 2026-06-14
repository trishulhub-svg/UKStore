import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// GET /api/attendance — get current user's attendance logs
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const role = user.role.toLowerCase()
  if (role !== 'driver' && role !== 'picker' && role !== 'manager' && role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden — staff role required' }, { status: 403 })
  }

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')

    const where: any = { userId: user.id }

    if (weekStart) {
      const start = new Date(weekStart)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      where.createdAt = { gte: start, lt: end }
    } else {
      // Default: current week (Monday - Sunday)
      const now = new Date()
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(now)
      monday.setDate(now.getDate() + mondayOffset)
      monday.setHours(0, 0, 0, 0)

      where.createdAt = { gte: monday }
    }

    const logs = await prisma.attendanceLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Check if currently clocked in (last log is clock_in with no matching clock_out)
    const lastLog = logs[0]
    const isClockedIn = lastLog?.type === 'clock_in'

    // Calculate current shift duration if clocked in
    let currentShiftStart: string | null = null
    if (isClockedIn) {
      currentShiftStart = lastLog.createdAt.toISOString()
    }

    return NextResponse.json({
      logs,
      isClockedIn,
      currentShiftStart,
    })
  } catch (err) {
    console.error('[Attendance GET]', err)
    return NextResponse.json({ error: 'Failed to fetch attendance logs' }, { status: 500 })
  }
}

// POST /api/attendance — clock in or clock out
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const role = user.role.toLowerCase()
  if (role !== 'driver' && role !== 'picker' && role !== 'manager' && role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden — staff role required' }, { status: 403 })
  }

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { type } = body // 'clock_in' or 'clock_out'

    if (!type || (type !== 'clock_in' && type !== 'clock_out')) {
      return NextResponse.json({ error: 'Invalid type. Must be clock_in or clock_out' }, { status: 400 })
    }

    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

    // Check last log to validate
    const lastLog = await prisma.attendanceLog.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (type === 'clock_in' && lastLog?.type === 'clock_in') {
      return NextResponse.json({ error: 'Already clocked in. Please clock out first.' }, { status: 400 })
    }

    if (type === 'clock_out' && (!lastLog || lastLog.type === 'clock_out')) {
      return NextResponse.json({ error: 'Not clocked in. Please clock in first.' }, { status: 400 })
    }

    const log = await prisma.attendanceLog.create({
      data: {
        userId: user.id,
        type,
        ipAddress,
      },
    })

    return NextResponse.json({ log }, { status: 201 })
  } catch (err) {
    console.error('[Attendance POST]', err)
    return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 })
  }
}
