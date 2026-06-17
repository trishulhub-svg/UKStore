import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

// GET /api/admin/shifts — get all shifts
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
    const weekStart = searchParams.get('weekStart')

    const where: any = {}

    if (weekStart) {
      const start = new Date(weekStart)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      where.date = { gte: start, lt: end }
    }

    const shifts = await prisma.shift.findMany({
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
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })

    // Get all staff for dropdown
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

    const formatted = shifts.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user.name || s.user.email,
      userRole: s.user.role,
      date: s.date.toISOString(),
      startTime: s.startTime,
      endTime: s.endTime,
      manualHours: s.manualHours,
      role: s.role,
      createdAt: s.createdAt.toISOString(),
    }))

    return NextResponse.json({ shifts: formatted, staff })
  } catch (err) {
    console.error('[Admin Shifts GET]', err)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }
}

// POST /api/admin/shifts — create a new shift
export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const { userId, date, startTime, endTime, shiftRole, manualHours } = body

    if (!userId || !date || !shiftRole) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, date, shiftRole' },
        { status: 400 }
      )
    }

    // Either (startTime + endTime) OR manualHours must be provided
    const hasTimeRange = startTime && endTime
    const hasManualHours = manualHours !== undefined && manualHours !== null && manualHours !== ''
    if (!hasTimeRange && !hasManualHours) {
      return NextResponse.json(
        { error: 'Provide either start/end time or manual hours' },
        { status: 400 }
      )
    }

    // Verify the user exists and is staff
    const staffUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!staffUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const shiftDate = new Date(date)
    shiftDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(shiftDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // Only check overlap when we have actual start/end times (manual-hours shifts skip this)
    if (hasTimeRange) {
      const overlapping = await prisma.shift.findFirst({
        where: {
          userId,
          date: { gte: shiftDate, lt: nextDay },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      })

      if (overlapping) {
        return NextResponse.json(
          { error: 'This employee already has an overlapping shift on this day' },
          { status: 409 }
        )
      }
    }

    // For manual-hours shifts, store the hours value and use a sentinel start/end
    // so the existing calendar grid (which keys on startTime/endTime) still groups them.
    const finalStartTime = hasTimeRange ? startTime : '00:00'
    const finalEndTime = hasTimeRange ? endTime : '00:00'
    const finalManualHours = hasManualHours ? parseFloat(manualHours) : null

    const shift = await prisma.shift.create({
      data: {
        userId,
        date: shiftDate,
        startTime: finalStartTime,
        endTime: finalEndTime,
        manualHours: finalManualHours,
        role: shiftRole,
      },
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
    })

    return NextResponse.json({
      shift: {
        id: shift.id,
        userId: shift.userId,
        userName: shift.user.name || shift.user.email,
        userRole: shift.user.role,
        date: shift.date.toISOString(),
        startTime: shift.startTime,
        endTime: shift.endTime,
        manualHours: shift.manualHours,
        role: shift.role,
        createdAt: shift.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[Admin Shifts POST]', err)
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }
}
