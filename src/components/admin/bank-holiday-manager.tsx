'use client'

import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Trash2, Plus, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────

interface BankHoliday {
  id: string
  name: string
  date: string
  mode: string
}

// ─── UK Bank Holiday Generator ────────────────────────────────

function getEasterDate(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getNextMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  if (day === 0) return addDays(d, 1) // Sunday -> Monday
  if (day === 6) return addDays(d, 2) // Saturday -> Monday
  return d // Already Monday-Friday
}

function getLastMondayOfMonth(year: number, month: number): Date {
  const d = new Date(year, month + 1, 0) // last day of month
  const day = d.getDay()
  if (day === 1) return d // already Monday
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d
}

function generateUKBankHolidays(year: number): Array<{ name: string; date: string; mode: string }> {
  const easter = getEasterDate(year)
  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  return [
    { name: "New Year's Day", date: formatDate(getNextMonday(new Date(year, 0, 1))), mode: 'auto_close' },
    { name: 'Good Friday', date: formatDate(addDays(easter, -2)), mode: 'auto_close' },
    { name: 'Easter Monday', date: formatDate(addDays(easter, 1)), mode: 'auto_close' },
    { name: 'May Day', date: formatDate(getNextMonday(new Date(year, 4, 1))), mode: 'auto_close' },
    { name: 'Spring Bank Holiday', date: formatDate(getLastMondayOfMonth(year, 4)), mode: 'reduced_hours' },
    { name: 'Summer Bank Holiday', date: formatDate(getLastMondayOfMonth(year, 7)), mode: 'reduced_hours' },
    { name: 'Christmas Day', date: formatDate(getNextMonday(new Date(year, 11, 25))), mode: 'auto_close' },
    { name: 'Boxing Day', date: formatDate(getNextMonday(new Date(year, 11, 26))), mode: 'auto_close' },
  ]
}

// ─── Mode Badge Colours ──────────────────────────────────────

const modeStyles: Record<string, string> = {
  auto_close: 'bg-red-100 text-red-700 border-red-200',
  reduced_hours: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-green-100 text-green-700 border-green-200',
}

const modeLabels: Record<string, string> = {
  auto_close: 'Auto Close',
  reduced_hours: 'Reduced Hours',
  normal: 'Normal',
}

// ─── Component ───────────────────────────────────────────────

export function BankHolidayManager() {
  const [holidays, setHolidays] = useState<BankHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bank-holidays')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setHolidays(data.holidays || [])
    } catch {
      toast.error('Failed to load bank holidays')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  const handleAddUKHolidays = async () => {
    setAdding(true)
    try {
      const generated = generateUKBankHolidays(selectedYear)
      const res = await fetch('/api/admin/bank-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holidays: generated }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`Added ${data.added} bank holidays for ${selectedYear}${data.skipped > 0 ? ` (${data.skipped} already existed)` : ''}`)
      fetchHolidays()
    } catch {
      toast.error('Failed to add bank holidays')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/bank-holidays/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Bank holiday removed')
      fetchHolidays()
    } catch {
      toast.error('Failed to delete bank holiday')
    }
  }

  const handleModeChange = async (id: string, mode: string) => {
    // Optimistically update UI
    setHolidays((prev) => prev.map((h) => (h.id === id ? { ...h, mode } : h)))
    // For simplicity, delete and re-add with new mode
    try {
      const holiday = holidays.find((h) => h.id === id)
      if (!holiday) return
      await fetch(`/api/admin/bank-holidays/${id}`, { method: 'DELETE' })
      await fetch('/api/admin/bank-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: holiday.name, date: holiday.date, mode }),
      })
      fetchHolidays()
    } catch {
      toast.error('Failed to update holiday mode')
      fetchHolidays()
    }
  }

  // Find next upcoming holiday
  const today = new Date().toISOString().split('T')[0]
  const upcomingHolidays = holidays
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const nextHoliday = upcomingHolidays[0] || null

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded h-10" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-gray-600" />
          UK Bank Holiday Scheduler
        </CardTitle>
        <CardDescription>
          Manage bank holidays for store hours. Auto-close or run reduced hours on UK bank holidays.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next Upcoming Holiday */}
        {nextHoliday && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Next Bank Holiday</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-900">{nextHoliday.name}</p>
                <p className="text-xs text-amber-700">
                  {new Date(nextHoliday.date + 'T12:00:00').toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <Badge variant="outline" className={modeStyles[nextHoliday.mode]}>
                {modeLabels[nextHoliday.mode]}
              </Badge>
            </div>
          </div>
        )}

        {/* Add UK Bank Holidays Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAddUKHolidays}
            disabled={adding}
            className="bg-[#16a34a] hover:bg-[#15803d] text-white"
          >
            {adding ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" /> Add UK Bank Holidays for {selectedYear}</>
            )}
          </Button>
        </div>

        <Separator />

        {/* Holiday List */}
        {holidays.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bank holidays configured</p>
            <p className="text-xs">Click the button above to add UK bank holidays</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {holidays.map((holiday) => {
              const isPast = holiday.date < today
              return (
                <div
                  key={holiday.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border ${
                    isPast ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${isPast ? 'text-gray-400' : 'text-gray-900'}`}>
                        {holiday.name}
                      </p>
                      {isPast && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500">
                          Past
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(holiday.date + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={holiday.mode}
                      onValueChange={(mode) => handleModeChange(holiday.id, mode)}
                    >
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto_close">Auto Close</SelectItem>
                        <SelectItem value="reduced_hours">Reduced Hours</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-600"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
