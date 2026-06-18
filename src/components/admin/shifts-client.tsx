'use client'

import { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'

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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SHIFTS = [
  { key: 'morning', label: 'Morning', startTime: '06:00', endTime: '14:00' },
  { key: 'evening', label: 'Evening', startTime: '14:00', endTime: '22:00' },
  { key: 'custom', label: 'Custom hours', startTime: '', endTime: '' },
]

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
  return date.toISOString().split('T')[0]
}

export function ShiftsClient() {
  const [shifts, setShifts] = useState<ShiftData[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
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
      }
    } catch (err) {
      console.error('Failed to fetch shifts:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [weekDates])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const handleCreateShift = async () => {
    if (!selectedDate || !selectedEmployee) return

    setCreating(true)
    try {
      // Resolve the payload based on which shift mode is selected
      const payload: any = {
        userId: selectedEmployee,
        date: selectedDate,
        shiftRole: selectedRole,
      }

      if (selectedShift === 'morning' || selectedShift === 'evening') {
        const shiftDef = SHIFTS.find((s) => s.key === selectedShift)!
        payload.startTime = shiftDef.startTime
        payload.endTime = shiftDef.endTime
      } else if (selectedShift === 'custom') {
        // For custom: prefer manualHours if provided, else require start+end
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
      } else {
        const data = await res.json()
        console.error('Failed to create shift:', data.error)
      }
    } catch (err) {
      console.error('Failed to create shift:', err)
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
      }
    } catch (err) {
      console.error('Failed to delete shift:', err)
    } finally {
      setDeleting(null)
    }
  }

  const getShiftsForCell = (date: Date, shiftKey: string): ShiftData[] => {
    const dateKey = formatDateKey(date)
    return shifts.filter((s) => {
      const shiftDate = s.date.split('T')[0]
      return shiftDate === dateKey && isShiftTimeMatch(s, shiftKey)
    })
  }

  const isShiftTimeMatch = (shift: ShiftData, shiftKey: string): boolean => {
    // Manual-hours shifts (manualHours != null) are bucketed into the "custom" row
    if (shift.manualHours !== null && shift.manualHours !== undefined) {
      return shiftKey === 'custom'
    }
    const def = SHIFTS.find((s) => s.key === shiftKey)!
    if (!def.startTime) return false // the 'custom' template has no preset times
    return shift.startTime === def.startTime && shift.endTime === def.endTime
  }

  const openAddDialog = (date?: string, shiftKey?: string) => {
    if (date) setSelectedDate(date)
    if (shiftKey && (shiftKey === 'morning' || shiftKey === 'evening' || shiftKey === 'custom')) {
      setSelectedShift(shiftKey)
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Shift</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Shift</Label>
                  <Select value={selectedShift} onValueChange={(v) => setSelectedShift(v as 'morning' | 'evening' | 'custom')}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning (06:00 - 14:00)</SelectItem>
                      <SelectItem value="evening">Evening (14:00 - 22:00)</SelectItem>
                      <SelectItem value="custom">Custom hours…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom shift fields — shown only when "Custom hours…" is selected */}
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
                    <div className="grid grid-cols-2 gap-3">
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

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2 sm:p-4 overflow-x-auto">
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
            {SHIFTS.map((shiftDef) => (
              <div key={shiftDef.key} className="grid grid-cols-8 gap-1 mb-1">
                <div className="p-2 flex flex-col justify-center">
                  <span className="text-xs font-medium text-gray-700">{shiftDef.label}</span>
                  <span className="text-[10px] text-gray-400">
                    {shiftDef.startTime && shiftDef.endTime
                      ? `${shiftDef.startTime}-${shiftDef.endTime}`
                      : 'manual hrs'}
                  </span>
                </div>
                {weekDates.map((date, i) => {
                  const cellShifts = getShiftsForCell(date, shiftDef.key)
                  const today = isToday(date)

                  return (
                    <div
                      key={i}
                      className={`p-1 min-h-[72px] border rounded-lg transition-colors cursor-pointer ${
                        today
                          ? 'border-[#16a34a]/30 bg-[#16a34a]/5'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (cellShifts.length === 0) {
                          openAddDialog(formatDateKey(date), shiftDef.key)
                        }
                      }}
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
                          <div className="flex items-center gap-1 min-w-0 truncate">
                            <User className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate font-medium">{s.userName}</span>
                            {s.manualHours !== null && s.manualHours !== undefined && (
                              <span className="ml-0.5 text-[9px] font-semibold text-gray-600">
                                {s.manualHours}h
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteShift(s.id)
                            }}
                            disabled={deleting === s.id}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                            aria-label="Delete shift"
                          >
                            <Trash2 className="h-3 w-3 text-red-500 hover:text-red-700" />
                          </button>
                        </div>
                      ))}
                      {cellShifts.length === 0 && (
                        <div className="flex items-center justify-center h-full opacity-0 hover:opacity-100 transition-opacity">
                          <Plus className="h-4 w-4 text-gray-300" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
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
              // Sum hours: prefer manualHours when set, else compute from start/end
              const totalHours = roleShifts.reduce((sum, s) => {
                if (s.manualHours !== null && s.manualHours !== undefined) return sum + s.manualHours
                const [sh, sm] = s.startTime.split(':').map(Number)
                const [eh, em] = s.endTime.split(':').map(Number)
                if (isNaN(sh) || isNaN(eh)) return sum
                return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60
              }, 0)
              return (
                <div key={role} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <div>
                    <p className="text-lg font-bold text-gray-900">{count}</p>
                    <p className="text-[10px] text-gray-500">
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
