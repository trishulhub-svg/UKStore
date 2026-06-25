import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

/**
 * GET /api/user/shifts
 *
 * Returns the current user's shifts. Used by the picker and driver
 * dashboards (for "Today's Shift" card) and the /picker/schedule and
 * /driver/schedule pages (for the week view).
 *
 * Query params:
 *   weekStart  — YYYY-MM-DD (optional). Returns shifts in the 7-day
 *                window [weekStart, weekStart+7). Defaults to the
 *                Monday of the current week.
 *
 * Response:
 *   {
 *     shifts:      Shift[],  // shifts in the requested week
 *     todayShifts: Shift[],  // shifts for today (always computed, regardless of weekStart)
 *     weekStart:   string,   // ISO date the requested week starts on
 *   }
 *
 * Each Shift:
 *   {
 *     id, date (ISO), startTime ("HH:MM"), endTime ("HH:MM"),
 *     manualHours (number | null), role ("PICKER" | "DRIVER" | "MANAGER" | ...),
 *     isToday (boolean)
 *   }
 *
 * Security: scoped to session.user.id — no way to read another user's
 * shifts. Auth required (401 if not logged in).
 */
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    )
  }

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')

    // ─── Resolve week start (Monday) ───────────────────────────────
    // Default: Monday of the current week.
    let weekStart: Date
    if (weekStartParam) {
      const parsed = new Date(weekStartParam)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'Invalid weekStart format. Use YYYY-MM-DD.' },
          { status: 400 },
        )
      }
      weekStart = new Date(parsed)
    } else {
      const now = new Date()
      const dayOfWeek = now.getDay() // 0=Sun ... 6=Sat
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      weekStart = new Date(now)
      weekStart.setDate(now.getDate() + mondayOffset)
    }
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    // ─── Today window (for the dashboard "Today's Shift" card) ────
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayStart.getDate() + 1)

    // Fetch the union of (this week's shifts) ∪ (today's shifts) in
    // one query — they usually overlap, but if the user is viewing a
    // different week we still want today's shift for the dashboard card.
    const fetchStart = todayStart < weekStart ? todayStart : weekStart
    const fetchEnd = todayEnd > weekEnd ? todayEnd : weekEnd

    const allShifts = await prisma.shift.findMany({
      where: {
        userId: user.id,
        date: { gte: fetchStart, lt: fetchEnd },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        manualHours: true,
        role: true,
      },
    })

    const isoTodayStart = todayStart.getTime()
    const isoTodayEnd = todayEnd.getTime()
    const isoWeekStart = weekStart.getTime()
    const isoWeekEnd = weekEnd.getTime()

    const toApi = (s: (typeof allShifts)[number]) => ({
      id: s.id,
      date: s.date.toISOString(),
      startTime: s.startTime,
      endTime: s.endTime,
      manualHours: s.manualHours,
      role: s.role,
      isToday:
        s.date.getTime() >= isoTodayStart && s.date.getTime() < isoTodayEnd,
    })

    const shifts = allShifts
      .filter(
        (s) => s.date.getTime() >= isoWeekStart && s.date.getTime() < isoWeekEnd,
      )
      .map(toApi)

    const todayShifts = allShifts
      .filter(
        (s) =>
          s.date.getTime() >= isoTodayStart &&
          s.date.getTime() < isoTodayEnd,
      )
      .map(toApi)

    return NextResponse.json({
      shifts,
      todayShifts,
      weekStart: weekStart.toISOString(),
    })
  } catch (err) {
    console.error('[/api/user/shifts]', err)
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 },
    )
  }
}
