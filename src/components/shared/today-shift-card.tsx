'use client'

/**
 * TodayShiftCard — compact dashboard card showing the user's shift(s)
 * for today. Fetches from /api/user/shifts and renders a single
 * highlight card with a link to the full schedule page.
 *
 * Used by:
 *   - picker-dashboard-client.tsx  (theme='picker', scheduleHref='/picker/schedule')
 *   - driver-dashboard-client.tsx  (theme='driver', scheduleHref='/driver/schedule')
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Clock, ChevronRight, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'
import type { ShiftEntry } from './employee-schedule-client'

interface Props {
  theme: 'picker' | 'driver'
  scheduleHref: string
}

const THEME = {
  picker: {
    accentText: 'text-orange-500',
    accentBgSoft: 'bg-orange-50',
    accentBorder: 'border-orange-300',
    accentBg: 'bg-orange-500',
  },
  driver: {
    accentText: 'text-[#16a34a]',
    accentBgSoft: 'bg-[#16a34a]/5',
    accentBorder: 'border-[#16a34a]/30',
    accentBg: 'bg-[#16a34a]',
  },
} as const

const roleBadgeColors: Record<string, string> = {
  PICKER: 'bg-orange-100 text-orange-800',
  DRIVER: 'bg-green-100 text-green-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  OWNER: 'bg-purple-100 text-purple-800',
}

export function TodayShiftCard({ theme, scheduleHref }: Props) {
  const t = THEME[theme]
  const [todayShifts, setTodayShifts] = useState<ShiftEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/api/user/shifts', { redirectOn401: false })
        if (!res.ok) {
          if (!cancelled) setError(true)
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setTodayShifts(data.todayShifts ?? [])
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Loading skeleton — keep card height stable so the dashboard
  // doesn't jump when the shift fetch resolves.
  if (todayShifts === null && !error) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="animate-pulse h-4 w-24 bg-gray-200 rounded" />
            <div className="animate-pulse h-5 w-5 bg-gray-200 rounded" />
          </div>
          <div className="animate-pulse h-10 bg-gray-100 rounded" />
        </CardContent>
      </Card>
    )
  }

  // Error state — keep card visible but show a soft error so the
  // dashboard doesn't break entirely. Click-through to schedule page
  // still works (user can retry from there).
  if (error) {
    return (
      <Link href={scheduleHref}>
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-gray-900">Today&apos;s Shift</p>
              <p className="text-xs text-gray-500">Couldn&apos;t load — tap to retry</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </CardContent>
        </Card>
      </Link>
    )
  }

  // No shift today
  if (todayShifts!.length === 0) {
    return (
      <Link href={scheduleHref}>
        <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-gray-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">No shift today</p>
                <p className="text-xs text-gray-500">Tap to view your weekly schedule</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </CardContent>
        </Card>
      </Link>
    )
  }

  // Has shift(s) today — show first one prominently, count of any others
  const first = todayShifts![0]
  const isManual = first.manualHours !== null && first.manualHours !== undefined
  const roleKey = (first.role || '').toUpperCase()
  const badgeClass = roleBadgeColors[roleKey] || 'bg-gray-100 text-gray-700'
  const roleLabel = roleKey.charAt(0) + roleKey.slice(1).toLowerCase()
  const extraCount = todayShifts!.length - 1

  return (
    <Link href={scheduleHref}>
      <Card
        className={`shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 ${t.accentBorder} ${t.accentBgSoft}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[11px] font-bold uppercase tracking-wide ${t.accentText}`}>
              Today&apos;s Shift
            </p>
            <CalendarDays className={`h-4 w-4 ${t.accentText}`} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-9 h-9 rounded-full ${t.accentBgSoft} flex items-center justify-center shrink-0`}>
                <Clock className={`h-4 w-4 ${t.accentText}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  {isManual
                    ? `${first.manualHours} hour${first.manualHours === 1 ? '' : 's'}`
                    : `${first.startTime} – ${first.endTime}`}
                </p>
                <p className="text-[11px] text-gray-500">
                  {isManual ? 'Manual hours shift' : 'Fixed-time shift'}
                  {extraCount > 0 && ` · +${extraCount} more`}
                </p>
              </div>
            </div>
            <Badge className={`${badgeClass} text-[10px] px-2 py-0.5`}>
              {roleLabel}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
