'use client'

import { useEffect, useState } from 'react'
import { Loader2, Monitor, Smartphone, Tablet, Trash2, LogOut, Globe, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

interface Session {
  id: string
  deviceType: string
  deviceName: string | null
  ipAddress: string | null
  createdAt: string
  lastSeenAt: string
  expiresAt: string
}

interface EmployeeSessionsDialogProps {
  employee: {
    id: string
    name: string | null
    email: string
    role: string
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatRelative(iso: string): string {
  try {
    const date = new Date(iso)
    const diff = Date.now() - date.getTime()
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return 'just now'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min} min ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} hr ago`
    const day = Math.floor(hr / 24)
    return `${day} day${day === 1 ? '' : 's'} ago`
  } catch {
    return iso
  }
}

function getDeviceIcon(deviceType: string) {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="h-5 w-5 text-blue-500" />
    case 'tablet':
      return <Tablet className="h-5 w-5 text-purple-500" />
    case 'desktop':
      return <Monitor className="h-5 w-5 text-gray-600" />
    default:
      return <Monitor className="h-5 w-5 text-gray-400" />
  }
}

export function EmployeeSessionsDialog({
  employee,
  open,
  onOpenChange,
}: EmployeeSessionsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const fetchSessions = async () => {
    if (!employee) return
    setLoading(true)
    try {
      const res = await apiFetch(`/api/admin/employees/${employee.id}/sessions`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to load sessions')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && employee) {
      fetchSessions()
    }
  }, [open, employee])

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId)
    try {
      const res = await apiFetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success('Session revoked — the user will be logged out on their next request')
      // Remove from local state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to revoke session')
      }
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAll = async () => {
    if (!employee) return
    if (sessions.length === 0) return
    if (!confirm(`Revoke all ${sessions.length} active sessions for ${employee.name || employee.email}? They will be logged out of every device immediately.`)) return
    setRevokingAll(true)
    try {
      const res = await apiFetch(`/api/admin/sessions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: employee.id }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`${data.revoked} session(s) revoked`)
      setSessions([])
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to revoke all sessions')
      }
    } finally {
      setRevokingAll(false)
    }
  }

  // Determine role-based device limit info
  const role = employee?.role.toUpperCase() || ''
  const limitText = role === 'OWNER'
    ? '1 device maximum (admin)'
    : role === 'DRIVER' || role === 'PICKER'
    ? '2 devices max (1 mobile + 1 desktop)'
    : 'Unlimited devices'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-[#16a34a]" />
            Active Sessions
          </DialogTitle>
          <DialogDescription>
            Manage devices where <strong>{employee?.name || employee?.email}</strong> is currently logged in.
            <br />
            <span className="text-xs text-gray-500">Device limit: {limitText}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <LogOut className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No active sessions</p>
            <p className="text-xs text-gray-400 mt-1">
              This user is not currently logged in on any device.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {sessions.length} active session{sessions.length === 1 ? '' : 's'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeAll}
                disabled={revokingAll || revokingId !== null}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                {revokingAll ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Revoking...</>
                ) : (
                  <><Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke All</>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-lg border border-gray-200 p-3 flex items-start gap-3"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getDeviceIcon(session.deviceType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {session.deviceName || 'Unknown device'}
                      </p>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {session.deviceType}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Created: {formatRelative(session.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Last seen: {formatRelative(session.lastSeenAt)}</span>
                      </div>
                      {session.ipAddress && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          <span>{session.ipAddress}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Expires: {formatDateTime(session.expiresAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRevoke(session.id)}
                    disabled={revokingId === session.id || revokingAll}
                    title="Revoke this session"
                  >
                    {revokingId === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>

            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <p>
                <strong>Revoking a session</strong> takes effect immediately on the next API
                request from that device. The user will be redirected to the login page.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
