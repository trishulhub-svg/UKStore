'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClockInOutButton } from '@/components/shared/clock-in-out-button'
import { CalendarDays, Clock, Timer } from 'lucide-react'

interface AttendanceLog {
  id: string
  type: 'clock_in' | 'clock_out'
  ipAddress: string | null
  createdAt: string
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PickerAttendanceClient() {
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [currentShiftStart, setCurrentShiftStart] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalHoursThisWeek, setTotalHoursThisWeek] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setIsClockedIn(data.isClockedIn)
        setCurrentShiftStart(data.currentShiftStart)
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Calculate total hours this week from paired logs
  useEffect(() => {
    let totalMs = 0
    const clockIns = logs.filter((l) => l.type === 'clock_in')
    for (const clockIn of clockIns) {
      const clockOut = logs.find(
        (l) =>
          l.type === 'clock_out' &&
          new Date(l.createdAt) > new Date(clockIn.createdAt)
      )
      if (clockOut) {
        totalMs += new Date(clockOut.createdAt).getTime() - new Date(clockIn.createdAt).getTime()
      } else if (clockIn === clockIns[clockIns.length - 1] && isClockedIn && currentShiftStart) {
        totalMs += Date.now() - new Date(currentShiftStart).getTime()
      }
    }
    setTotalHoursThisWeek(totalMs)
  }, [logs, isClockedIn, currentShiftStart])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Attendance</h1>

      {/* Clock In/Out */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-3">
            {isClockedIn ? (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                <span className="text-gray-600">Currently on shift</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">You are not clocked in</p>
            )}
            <ClockInOutButton variant="default" />
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <Timer className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatDuration(totalHoursThisWeek)}</p>
              <p className="text-xs text-gray-500">Total hours worked</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Log */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No attendance records this week</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      log.type === 'clock_in' ? 'bg-[#16a34a]' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-900">
                      {log.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">{formatDateTime(log.createdAt)}</p>
                    {log.ipAddress && (
                      <p className="text-[10px] text-gray-400">IP: {log.ipAddress}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
