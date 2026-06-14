'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Clock, LogIn, LogOut } from 'lucide-react'

interface ClockInOutButtonProps {
  variant?: 'default' | 'compact'
}

export function ClockInOutButton({ variant = 'default' }: ClockInOutButtonProps) {
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [currentShiftStart, setCurrentShiftStart] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance')
      if (res.ok) {
        const data = await res.json()
        setIsClockedIn(data.isClockedIn)
        setCurrentShiftStart(data.currentShiftStart)
      }
    } catch (err) {
      console.error('Failed to fetch attendance status:', err)
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Timer for shift duration
  useEffect(() => {
    if (!isClockedIn || !currentShiftStart) {
      setElapsed(0)
      return
    }

    const startMs = new Date(currentShiftStart).getTime()
    setElapsed(Date.now() - startMs)

    const interval = setInterval(() => {
      setElapsed(Date.now() - startMs)
    }, 1000)

    return () => clearInterval(interval)
  }, [isClockedIn, currentShiftStart])

  const handleClockAction = async () => {
    setLoading(true)
    try {
      const type = isClockedIn ? 'clock_out' : 'clock_in'
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        await fetchStatus()
      } else {
        const data = await res.json()
        console.error('Clock action failed:', data.error)
      }
    } catch (err) {
      console.error('Failed to clock in/out:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  if (initialLoading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-8 w-24 bg-gray-200 rounded-md" />
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {isClockedIn && (
          <div className="flex items-center gap-1 text-xs font-mono text-gray-600">
            <Clock className="h-3 w-3 text-[#16a34a]" />
            <span>{formatDuration(elapsed)}</span>
          </div>
        )}
        <Button
          size="sm"
          onClick={handleClockAction}
          disabled={loading}
          className={`h-8 text-xs font-medium ${
            isClockedIn
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-[#16a34a] hover:bg-[#15803d] text-white'
          }`}
        >
          {loading ? '...' : isClockedIn ? (
            <><LogOut className="h-3 w-3 mr-1" />Out</>
          ) : (
            <><LogIn className="h-3 w-3 mr-1" />In</>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {isClockedIn && currentShiftStart && (
        <div className="flex items-center gap-1.5 text-sm font-mono text-gray-600">
          <div className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
          <Clock className="h-4 w-4 text-[#16a34a]" />
          <span>{formatDuration(elapsed)}</span>
        </div>
      )}
      <Button
        onClick={handleClockAction}
        disabled={loading}
        className={`h-10 font-medium ${
          isClockedIn
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-[#16a34a] hover:bg-[#15803d] text-white'
        }`}
      >
        {loading ? 'Please wait...' : isClockedIn ? (
          <><LogOut className="h-4 w-4 mr-2" />Clock Out</>
        ) : (
          <><LogIn className="h-4 w-4 mr-2" />Clock In</>
        )}
      </Button>
    </div>
  )
}
