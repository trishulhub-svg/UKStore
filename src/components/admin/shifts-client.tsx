'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  CalendarDays,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  User,
  Store,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'
import { toast } from 'sonner'

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
}

interface ShiftData {
  id: string
  userId: string
  userName: string
  userRole: string
  date: string
  startTime: string
  endTime: string
  manualHours: number | null
  role: string
  createdAt: string
}

interface DayHours {
  open: string
  close: string
  closed: boolean
}

type OpeningHours = Record<string, DayHours | undefined>

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const roleColors: Record<string, string> = {
  OWNER: 'bg-purple-200 text-purple-900 border-purple-300',
  MANAGER: 'bg-green-200 text-green-900 border-green-300',
  DRIVER: 'bg-blue-200 text-blue-900 border-blue-300',
  PICKER: 'bg-orange-200 text-orange-900 border-orange-300',
}

const roleDotColors: Record<string, string> = {
  OWNER: 'bg-purple-500',
  MANAGER: 'bg-green-500',
  DRIVER: 'bg-blue-500',
  PICKER: 'bg-orange-500',
}

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parse "HH:MM" into total minutes since midnight.
 */
function timeToMinutes(t: string): number {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return NaN
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Convert minutes since midnight to "HH:MM".
 */
function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Compute the morning/evening shift times for a given day from the store's
 * opening hours.
 *
 *   - If the store is closed that day → returns null (only "Custom" allowed).
 *   - Morning = open → midpoint
 *   - Evening = midpoint → close
 *
 * Falls back to 06:00-14:00 / 14:00-22:00 if opening hours are not available.
 */
function getShiftTimesForDay(
  dayIndex: number,
  openingHours: OpeningHours | null
): { morning: { start: string; end: string } | null; evening: { start: string; end: string } | null } {
  const fallbackMorning = { start: '06:00', end: '14:00' }
  const fallbackEvening = { start: '14:00', end: '22:00' }

  if (!openingHours) {
    return { morning: fallbackMorning, evening: fallbackEvening }
  }

  const dayKey = DAY_KEYS[dayIndex]
  const dayHours = openingHours[dayKey]
  if (!dayHours || dayHours.closed || !dayHours.open || !dayHours.close) {
    return { morning: null, evening: null }
  }

  const openMin = timeToMinutes(dayHours.open)
  const closeMin = timeToMinutes(dayHours.close)
  if (isNaN(openMin) || isNaN(closeMin) || closeMin <= openMin) {
    return { morning: fallbackMorning, evening: fallbackEvening }
  }

  const midMin = Math.floor((openMin + closeMin) / 2)
  return {
    morning: { start: minutesToTime(openMin), end: minutesToTime(midMin) },
    evening: { start: minutesToTime(midMin), end: minutesToTime(closeMin) },
  }
}

export function ShiftsClient() {
  const [shifts, setShifts] = useState<ShiftData[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [openingHours, setOpeningHours] = useState<OpeningHours | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New shift form
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedShift, setSelectedShift] = useState<'morning' | 'evening' | 'custom'>('morning')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedRole, setSelectedRole] = useState('DRIVER')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [manualHours, setManualHours] = useState('')
  const [creating, setCreating] = useState(false)

  const weekDates = getWeekDates(weekOffset)

  const fetchData = useCallback(async () => {
    try {
      const monday = weekDates[0]
      const params = new URLSearchParams()
      params.set('weekStart', monday.toISOString())
      const res = await apiFetch(`/api/admin/shifts?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setShifts(data.shifts || [])
        setStaff(data.staff || [])
        // Use opening hours from the shifts response if provided; otherwise fall back to /api/store/status
        if (data.openingHours) {
          setOpeningHours(data.openingHours)
        }
      }
    } catch (err) {
      console.error('Failed to fetch shifts:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [weekDates])

  // Fetch store opening hours on mount (so we have them even if the shifts endpoint doesn't return them)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/api/store/status')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.openingHours) {
          setOpeningHours(data.openingHours)
        }
      } catch {
        // Non-critical — fallback to 06:00-14:00 / 14:00-22:00
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // Compute shift presets for the currently-selected date
  const selectedDateShiftTimes = useMemo(() => {
    if (!selectedDate) return null
    // Find the day index (Mon=0, Sun=6)
    const d = new Date(selectedDate + 'T00:00:00')
    const jsDay = d.getDay()
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1
    return getShiftTimesForDay(dayIndex, openingHours)
  }, [selectedDate, openingHours])

  // Build the SHIFTS array dynamically based on the selected date's store hours
  const shiftsForSelectedDate = useMemo(() => {
    const arr: { key: 'morning' | 'evening' | 'custom'; label: string; startTime: string; endTime: string; disabled?: boolean }[] = []
    if (selectedDateShiftTimes?.morning) {
      arr.push({
        key: 'morning',
        label: 'Morning',
        startTime: selectedDateShiftTimes.morning.start,
        endTime: selectedDateShiftTimes.morning.end,
      })
    } else {
      arr.push({ key: 'morning', label: 'Morning (store closed)', startTime: '', endTime: '', disabled: true })
    }
    if (selectedDateShiftTimes?.evening) {
      arr.push({
        key: 'evening',
        label: 'Evening',
        startTime: selectedDateShiftTimes.evening.start,
        endTime: selectedDateShiftTimes.evening.end,
      })
    } else {
      arr.push({ key: 'evening', label: 'Evening (store closed)', startTime: '', endTime: '', disabled: true })
    }
    arr.push({ key: 'custom', label: 'Custom hours', startTime: '', endTime: '' })
    return arr
  }, [selectedDateShiftTimes])

  // Build the SHIFTS array for the calendar grid rows (uses TODAY's store hours as a reasonable default
  // for the row labels — actual cell matching uses per-day hours via getShiftsForCell)
  const calendarShiftRows = useMemo(() => {
    return weekDates.map((date, dayIndex) => getShiftTimesForDay(dayIndex, openingHours))
  }, [weekDates, openingHours])

  // For the calendar grid labels, we show the morning/evening times from the FIRST day of the week
  // (or fall back to defaults). In practice the times vary per day, but for the row label we just
  // need a representative label — the cell matching logic uses per-day hours.
  const calendarRowLabels = useMemo(() => {
    const firstDay = calendarShiftRows[0] || null
    return {
      morning: firstDay?.morning ? `${firstDay.morning.start}-${firstDay.morning.end}` : 'closed',
      evening: firstDay?.evening ? `${firstDay.evening.start}-${firstDay.evening.end}` : 'closed',
    }
  }, [calendarShiftRows])

  const handleCreateShift = async () => {
    if (!selectedDate || !selectedEmployee) return

    // If the user picked Morning or Evening but the store is closed that day, block
    if (selectedShift !== 'custom' && selectedDateShiftTimes) {
      const preset = selectedDateShiftTimes[selectedShift]
      if (!preset) {
        toast.error(`Store is closed on the selected day — only Custom shifts are allowed.`)
        return
      }
    }

    setCreating(true)
    try {
      const payload: any = {
        userId: selectedEmployee,
        date: selectedDate,
        shiftRole: selectedRole,
      }

      if (selectedShift === 'morning' || selectedShift === 'evening') {
        const preset = selectedDateShiftTimes?.[selectedShift]
        if (!preset) throw new Error('Store is closed on the selected day')
        payload.startTime = preset.start
        payload.endTime = preset.end
      } else if (selectedShift === 'custom') {
        if (manualHours) {
          payload.manualHours = manualHours
        } else if (customStart && customEnd) {
          payload.startTime = customStart
          payload.endTime = customEnd
        } else {
          throw new Error('Provide either manual hours or start/end times')
        }
      }

      const res = await apiFetch('/api/admin/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setDialogOpen(false)
        setSelectedDate('')
        setSelectedEmployee('')
        setSelectedShift('morning')
        setCustomStart('')
        setCustomEnd('')
        setManualHours('')
        fetchData()
        toast.success('Shift assigned')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create shift')
      }
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to create shift')
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteShift = async (shiftId: string) => {
    setDeleting(shiftId)
    try {
      const res = await apiFetch(`/api/admin/shifts/${shiftId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchData()
        toast.success('Shift deleted')
      }
    } catch (err) {
      console.error('Failed to delete shift:', err)
    } finally {
      setDeleting(null)
    }
  }

  const getShiftsForCell = (date: Date, dayIndex: number, shiftKey: string): ShiftData[] => {
    const dateKey = formatDateKey(date)
    const dayShiftTimes = calendarShiftRows[dayIndex]
    return shifts.filter((s) => {
      const shiftDate = s.date.split('T')[0]
      return shiftDate === dateKey && isShiftTimeMatch(s, shiftKey, dayShiftTimes)
    })
  }

  const isShiftTimeMatch = (
    shift: ShiftData,
    shiftKey: string,
    dayShiftTimes: { morning: { start: string; end: string } | null; evening: { start: string; end: string } | null } | null
  ): boolean => {
    // Manual-hours shifts are always bucketed into "custom"
    if (shift.manualHours !== null && shift.manualHours !== undefined) {
      return shiftKey === 'custom'
    }
    if (shiftKey === 'custom') return false
    if (!dayShiftTimes) return false
    const preset = dayShiftTimes[shiftKey as 'morning' | 'evening']
    if (!preset) return false
    return shift.startTime === preset.start && shift.endTime === preset.end
  }

  const openAddDialog = (date?: string, shiftKey?: string) => {
    if (date) setSelectedDate(date)
    if (shiftKey && (shiftKey === 'morning' || shiftKey === 'evening' || shiftKey === 'custom')) {
      // If the preset is disabled for this day, fall back to custom
      const preset = shiftsForSelectedDate.find((s) => s.key === shiftKey)
      if (preset?.disabled) {
        setSelectedShift('custom')
      } else {
        setSelectedShift(shiftKey)
      }
    }
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="h-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
            {weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="h-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(0)}
              className="h-9 text-xs"
            >
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#16a34a] hover:bg-[#15803d] text-white h-9">
                <Plus className="h-4 w-4 mr-1" />
                Add Shift
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assign Shift</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Employee + Role + Shift Role FIRST (so the date picker opening upward doesn't cover them) */}
                <div>
                  <Label>Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name || s.email} ({s.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Shift Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="DRIVER">Driver</SelectItem>
                      <SelectItem value="PICKER">Picker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date field — placed AFTER the selects so its native picker overlay doesn't cover them */}
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value)
                      // If the currently-selected shift preset is disabled for the new date, switch to custom
                      if (selectedShift !== 'custom') {
                        const newDate = new Date(e.target.value + 'T00:00:00')
                        const jsDay = newDate.getDay()
                        const dayIndex = jsDay === 0 ? 6 : jsDay - 1
                        const times = getShiftTimesForDay(dayIndex, openingHours)
                        if (!times?.[selectedShift]) {
                          setSelectedShift('custom')
                        }
                      }
                    }}
                    className="mt-1"
                  />
                  {selectedDate && selectedDateShiftTimes && !selectedDateShiftTimes.morning && !selectedDateShiftTimes.evening && (
                    <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      Store is closed on this day — only Custom shifts are available.
                    </p>
                  )}
                </div>

                {/* Shift preset — options are dynamically generated based on the selected date's store hours */}
                <div>
                  <Label>Shift</Label>
                  <Select
                    value={selectedShift}
                    onValueChange={(v) => setSelectedShift(v as 'morning' | 'evening' | 'custom')}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftsForSelectedDate.map((s) => (
                        <SelectItem key={s.key} value={s.key} disabled={s.disabled}>
                          {s.label}
                          {s.startTime && s.endTime ? ` (${s.startTime} - ${s.endTime})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDate && selectedDateShiftTimes && selectedDateShiftTimes.morning && selectedDateShiftTimes.evening && (
                    <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Shift times auto-adjust to store hours for the selected day.
                    </p>
                  )}
                </div>

                {/* Custom shift fields — shown only when "Custom hours" is selected */}
                {selectedShift === 'custom' && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600">
                      Enter either a total hours figure (e.g. 4.5 for a 4.5-hour shift) <em>or</em> specific start/end times.
                    </p>
                    <div>
                      <Label>Total Hours (manual)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={manualHours}
                        onChange={(e) => setManualHours(e.target.value)}
                        placeholder="e.g., 4.5"
                        className="mt-1"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Use this for shifts where exact start/end don't matter (e.g., salaried or per-task work).
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span>OR</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="mt-1"
                          disabled={!!manualHours}
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="mt-1"
                          disabled={!!manualHours}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleCreateShift}
                  disabled={creating || !selectedDate || !selectedEmployee}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white"
                >
                  {creating ? 'Creating...' : 'Assign Shift'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Role Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(roleDotColors).map(([role, color]) => (
          <div key={role} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <span className="text-xs text-gray-600">{role.charAt(0) + role.slice(1).toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid — wraps in overflow-x-auto on mobile with a hint */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="overflow-x-auto -mx-2 px-2 pb-2">
            <div className="min-w-[640px]">
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-1 mb-1">
                <div className="p-2 text-xs font-medium text-gray-400">Shift</div>
                {weekDates.map((date, i) => (
                  <div
                    key={i}
                    className={`p-2 text-center text-xs font-medium rounded-t-lg ${
                      isToday(date)
                        ? 'bg-[#16a34a]/10 text-[#16a34a] font-bold'
                        : 'text-gray-500'
                    }`}
                  >
                    <div>{DAYS[i]}</div>
                    <div className="text-lg font-bold mt-0.5">{date.getDate()}</div>
                  </div>
                ))}
              </div>

              {/* Shift Rows */}
              {(['morning', 'evening', 'custom'] as const).map((shiftKey) => (
                <div key={shiftKey} className="grid grid-cols-8 gap-1 mb-1">
                  <div className="p-2 flex flex-col justify-center">
                    <span className="text-xs font-medium text-gray-700">
                      {shiftKey === 'morning' ? 'Morning' : shiftKey === 'evening' ? 'Evening' : 'Custom hours'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {shiftKey === 'morning'
                        ? calendarRowLabels.morning
                        : shiftKey === 'evening'
                        ? calendarRowLabels.evening
                        : 'manual hrs'}
                    </span>
                  </div>
                  {weekDates.map((date, i) => {
                    const cellShifts = getShiftsForCell(date, i, shiftKey)
                    const today = isToday(date)
                    const dayHours = calendarShiftRows[i]
                    const closedToday = shiftKey !== 'custom' && !dayHours?.[shiftKey]

                    return (
                      <div
                        key={i}
                        className={`p-1 min-h-[72px] border rounded-lg transition-colors ${
                          closedToday
                            ? 'border-gray-100 bg-gray-50/50 cursor-not-allowed'
                            : today
                            ? 'border-[#16a34a]/30 bg-[#16a34a]/5 cursor-pointer hover:border-[#16a34a]/50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (closedToday) return
                          if (cellShifts.length === 0) {
                            openAddDialog(formatDateKey(date), shiftKey)
                          }
                        }}
                        title={closedToday ? 'Store closed' : undefined}
                      >
                        {cellShifts.map((s) => (
                          <div
                            key={s.id}
                            className={`text-[10px] leading-tight rounded px-1.5 py-1 mb-0.5 border ${
                              roleColors[s.role] || 'bg-gray-100 border-gray-200'
                            } flex items-center justify-between group`}
                            title={
                              s.manualHours !== null && s.manualHours !== undefined
                                ? `${s.userName} — ${s.manualHours}h (manual)`
                                : `${s.userName} — ${s.startTime}-${s.endTime}`
                            }
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              <User className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate font-medium">{s.userName}</span>
                              {s.manualHours !== null && s.manualHours !== undefined && (
                                <span className="ml-0.5 text-[9px] font-semibold text-gray-600">
                                  {s.manualHours}h
                                </span>
                              )}
                            </div>
                            {/* Delete button — always visible on mobile (no hover-only), opacity-fades on desktop */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteShift(s.id)
                              }}
                              disabled={deleting === s.id}
                              className="shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-1 p-0.5"
                              aria-label="Delete shift"
                            >
                              <Trash2 className="h-3 w-3 text-red-500 hover:text-red-700" />
                            </button>
                          </div>
                        ))}
                        {cellShifts.length === 0 && !closedToday && (
                          <div className="flex items-center justify-center h-full opacity-30 md:opacity-0 md:hover:opacity-100 transition-opacity">
                            <Plus className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        {closedToday && (
                          <div className="flex items-center justify-center h-full text-[9px] text-gray-300">
                            Closed
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          {/* Mobile horizontal-scroll hint */}
          <p className="text-[10px] text-gray-400 mt-2 sm:hidden text-center">
            ← Swipe horizontally to view all days →
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Week Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(roleDotColors).map(([role, color]) => {
              const roleShifts = shifts.filter((s) => s.role === role)
              const count = roleShifts.length
              const totalHours = roleShifts.reduce((sum, s) => {
                if (s.manualHours !== null && s.manualHours !== undefined) return sum + s.manualHours
                const [sh, sm] = s.startTime.split(':').map(Number)
                const [eh, em] = s.endTime.split(':').map(Number)
                if (isNaN(sh) || isNaN(eh)) return sum
                return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60
              }, 0)
              return (
                <div key={role} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-gray-900">{count}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {role.charAt(0) + role.slice(1).toLowerCase()} shifts · {totalHours.toFixed(1)}h
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
