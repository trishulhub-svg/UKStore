'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  User,
  Search,
  RefreshCw,
  CalendarDays,
  Globe,
  Timer,
} from 'lucide-react'

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
}

interface PairedLog {
  id: string
  userId: string
  userName: string
  userRole: string
  clockInTime: string
  clockOutTime: string | null
  duration: number
  ipAddress: string | null
  isActive: boolean
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

const roleColors: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  MANAGER: 'bg-green-100 text-green-800',
  DRIVER: 'bg-blue-100 text-blue-800',
  PICKER: 'bg-orange-100 text-orange-800',
}

export function AttendanceClient() {
  const [logs, setLogs] = useState<PairedLog[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [currentlyClockedIn, setCurrentlyClockedIn] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('all')

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (employeeFilter && employeeFilter !== 'all') params.set('employeeId', employeeFilter)

      const res = await fetch(`/api/admin/attendance?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setStaff(data.staff || [])
        setCurrentlyClockedIn(data.currentlyClockedIn || [])
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [startDate, endDate, employeeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // Set default date range to current week
  useEffect(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)

    setStartDate(monday.toISOString().split('T')[0])
    setEndDate(now.toISOString().split('T')[0])
  }, [])

  const clockedInStaff = staff.filter((s) => currentlyClockedIn.includes(s.id))

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Live Attendance Register */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-pulse" />
              Live Attendance
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {clockedInStaff.length} online
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {clockedInStaff.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No staff currently clocked in
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {clockedInStaff.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                >
                  <div className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                  <span className="text-sm font-medium text-gray-900">{s.name || s.email}</span>
                  <Badge className={roleColors[s.role] || 'bg-gray-100 text-gray-800'} variant="secondary">
                    {s.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <Label htmlFor="startDate" className="text-xs">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label htmlFor="employee" className="text-xs">Employee</Label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger id="employee" className="mt-1 h-9">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.email} ({s.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-600" />
            Timesheet Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No attendance records found</p>
              <p className="text-xs text-gray-400">Try adjusting the date range</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Role</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Clock In</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Clock Out</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Duration</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {log.isActive && (
                              <div className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                            )}
                            <span className="font-medium text-gray-900">{log.userName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge className={roleColors[log.userRole] || 'bg-gray-100 text-gray-800'} variant="secondary">
                            {log.userRole}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-gray-600">{formatDateTime(log.clockInTime)}</td>
                        <td className="py-3 px-3 text-gray-600">
                          {log.clockOutTime ? formatDateTime(log.clockOutTime) : (
                            <span className="text-[#16a34a] font-medium">Active</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <Timer className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium text-gray-900">{formatDuration(log.duration)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <Globe className="h-3 w-3" />
                            {log.ipAddress || 'N/A'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.isActive && (
                          <div className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                        )}
                        <span className="font-medium text-gray-900 text-sm">{log.userName}</span>
                      </div>
                      <Badge className={roleColors[log.userRole] || 'bg-gray-100 text-gray-800'} variant="secondary">
                        {log.userRole}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">In:</span>
                        <span className="ml-1 text-gray-700">{formatDateTime(log.clockInTime)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Out:</span>
                        <span className="ml-1 text-gray-700">
                          {log.clockOutTime ? formatDateTime(log.clockOutTime) : 'Active'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-1 font-medium text-gray-900">{formatDuration(log.duration)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-500">{log.ipAddress || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
