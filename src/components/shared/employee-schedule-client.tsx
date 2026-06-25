'use client'

/**
 * EmployeeScheduleClient — shared week-view schedule UI for pickers
 * and drivers. Renders a week navigation header + day-grouped list
 * of shifts. Fetches from /api/user/shifts?weekStart=YYYY-MM-DD.
 *
 * Used by:
 *   /picker/schedule  (theme='picker', accentClass='orange-500')
 *   /driver/schedule  (theme='driver', accentClass='#16a34a')
 *
 * The component is role-agnostic — it just shows whatever shifts the
 * API returns for the current user (so dual-role staff see all their
 * shifts in one list, with a role badge per shift).
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'

export interface ShiftEntry {
  id: string
  date: string
  startTime: string
  endTime: string
  manualHours: number | null
  role: string
  isToday: boolean
}

interface Props {
  /** 'picker' or 'driver' — controls accent color only. */
  theme: 'picker' | 'driver'
  /** Where the "Back to dashboard" link goes. */
  dashboardHref: string
  /** Optional: today's shift to highlight at the top. */
  todayShifts?: ShiftEntry[]
}

const THEME = {
  picker: {
    accentText: 'text-orange-500',
    accentBg: 'bg-orange-500',
    accentBgSoft: 'bg-orange-50',
    accentBorder: 'border-orange-300',
    accentRing: 'hover:border-orange-400',
    accentBgButton: 'bg-orange-500 hover:bg-orange-600',
  },
  driver: {
    accentText: 'text-[#16a34a]',
    accentBg: 'bg-[#16a34a]',
    accentBgSoft: 'bg-[#16a34a]/5',
    accentBorder: 'border-[#16a34a]/30',
    accentRing: 'hover:border-[#16a34a]/50',
    accentBgButton: 'bg-[#16a34a] hover:bg-[#15803d]',
  },
} as const

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Returns the Monday of the week containing `date` (or today if null). */
function getMondayOfWeek(date: Date | null): Date {
  const ref = date ? new Date(date) : new Date()
  const dayOfWeek = ref.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(ref)
  monday.setDate(ref.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/** Format a Date as YYYY-MM-DD (for the API query param). */
function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns the 7 dates (Mon-Sun) of the week starting at `monday`. */
function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const roleBadgeColors: Record<string, string> = {
  PICKER: 'bg-orange-100 text-orange-800',
  DRIVER: 'bg-green-100 text-green-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  OWNER: 'bg-purple-100 text-purple-800',
}

export function EmployeeScheduleClient({
  theme,
  dashboardHref,
  todayShifts: initialTodayShifts,
}: Props) {
  const t = THEME[theme]
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(null))
  const [shifts, setShifts] = useState<ShiftEntry[]>([])
  const [todayShifts, setTodayShifts] = useState<ShiftEntry[]>(
    initialTodayShifts ?? [],
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchShifts = useCallback(
    async (ws: Date) => {
      setRefreshing(true)
      setError(null)
      try {
        const res = await apiFetch(
          `/api/user/shifts?weekStart=${formatDateKey(ws)}`,
        )
        if (!res.ok) {
          throw new Error(`Failed to fetch shifts (${res.status})`)
        }
        const data = await res.json()
        setShifts(data.shifts ?? [])
        setTodayShifts(data.todayShifts ?? [])
      } catch (err) {
        console.error('[schedule] fetch error:', err)
        setError('Could not load shifts. Pull to refresh.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchShifts(weekStart)
  }, [weekStart, fetchShifts])

  const weekDates = getWeekDates(weekStart)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Group shifts by day-of-week index (0=Mon ... 6=Sun)
  const shiftsByDay: ShiftEntry[][] = Array.from({ length: 7 }, () => [])
  for (const shift of shifts) {
    const shiftDate = new Date(shift.date)
    for (let i = 0; i < 7; i++) {
      if (isSameDate(shiftDate, weekDates[i])) {
        shiftsByDay[i].push(shift)
        break
      }
    }
  }

  // Total hours across the week (for the summary)
  const totalHours = shifts.reduce((sum, s) => {
    if (s.manualHours !== null && s.manualHours !== undefined) {
      return sum + s.manualHours
    }
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    if (isNaN(sh) || isNaN(eh)) return sum
    return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }, 0)

  const isCurrentWeek = isSameDate(weekStart, getMondayOfWeek(null))

  const goPrevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }
  const goNextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }
  const goThisWeek = () => setWeekStart(getMondayOfWeek(null))

  // Format the week range header: e.g. "23 – 29 Jun 2026"
  const weekEnd = weekDates[6]
  const rangeLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${MONTH_ABBR[weekStart.getMonth()]} ${weekStart.getFullYear()}`
      : `${weekStart.getDate()} ${MONTH_ABBR[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTH_ABBR[weekEnd.getMonth()]} ${weekStart.getFullYear()}`

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className={`h-5 w-5 ${t.accentText}`} />
            My Schedule
          </h1>
          <Link
            href={dashboardHref}
            className="text-xs text-gray-500 hover:underline"
          >
            ← Back to dashboard
          </Link>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchShifts(weekStart)}
          disabled={refreshing}
          className="h-8 text-gray-500"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Week navigation */}
      <Card className="shadow-sm">
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrevWeek}
            className="h-9 w-9 p-0"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-gray-900">{rangeLabel}</p>
            {!isCurrentWeek && (
              <button
                onClick={goThisWeek}
                className={`text-[11px] ${t.accentText} hover:underline`}
              >
                Jump to this week
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={goNextWeek}
            className="h-9 w-9 p-0"
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>

      {/* Today's shift banner (only shown if viewing current week) */}
      {isCurrentWeek && todayShifts.length > 0 && (
        <Card className={`shadow-sm border-l-4 ${t.accentBorder} ${t.accentBgSoft}`}>
          <CardContent className="p-3">
            <p className={`text-[11px] font-bold uppercase tracking-wide ${t.accentText} mb-1`}>
              Today
            </p>
            <div className="space-y-1.5">
              {todayShifts.map((s) => (
                <ShiftRow key={s.id} shift={s} theme={theme} compact />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week summary */}
      <Card className="shadow-sm">
        <CardContent className="p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">This week</p>
            <p className="text-sm font-bold text-gray-900">
              {shifts.length} shift{shifts.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h total
            </p>
          </div>
          <CalendarDays className={`h-6 w-6 ${t.accentText}`} />
        </CardContent>
      </Card>

      {/* Error banner */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Day-by-day list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-20" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <CalendarDays className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">No shifts scheduled</p>
            <p className="text-xs text-gray-400 mt-1">
              You have no shifts for this week. Check with your manager if this seems wrong.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {weekDates.map((date, i) => {
            const dayShifts = shiftsByDay[i]
            if (dayShifts.length === 0) return null
            const isToday = isSameDate(date, today)
            return (
              <div key={i}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className={`text-xs font-bold ${isToday ? t.accentText : 'text-gray-700'}`}>
                    {DAY_NAMES[i]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {date.getDate()} {MONTH_ABBR[date.getMonth()]}
                  </span>
                  {isToday && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.accentBgSoft} ${t.accentText}`}>
                      TODAY
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {dayShifts.map((s) => (
                    <ShiftRow key={s.id} shift={s} theme={theme} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Single shift row ────────────────────────────────────────────
function ShiftRow({
  shift,
  theme,
  compact = false,
}: {
  shift: ShiftEntry
  theme: 'picker' | 'driver'
  compact?: boolean
}) {
  const t = THEME[theme]
  const isManual =
    shift.manualHours !== null && shift.manualHours !== undefined
  const roleKey = (shift.role || '').toUpperCase()
  const badgeClass = roleBadgeColors[roleKey] || 'bg-gray-100 text-gray-700'
  const roleLabel = roleKey.charAt(0) + roleKey.slice(1).toLowerCase()

  return (
    <Card className={`shadow-sm ${compact ? 'border-0' : ''}`}>
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 rounded-full ${t.accentBgSoft} flex items-center justify-center shrink-0`}>
            <Clock className={`h-4 w-4 ${t.accentText}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {isManual
                ? `${shift.manualHours} hour${shift.manualHours === 1 ? '' : 's'}`
                : `${shift.startTime} – ${shift.endTime}`}
            </p>
            <p className="text-[11px] text-gray-500">
              {isManual ? 'Manual hours shift' : 'Fixed-time shift'}
            </p>
          </div>
        </div>
        <Badge className={`${badgeClass} text-[10px] px-2 py-0.5`}>
          {roleLabel}
        </Badge>
      </CardContent>
    </Card>
  )
}
