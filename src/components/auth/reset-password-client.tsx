'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { getRoleBasedRedirect } from '@/lib/auth-client'

export function ResetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isForced = searchParams.get('forced') === '1'

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isForced && !currentPassword) {
      toast.error('Current password is required')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('Password must contain both letters and numbers')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(
        `/api/auth/reset-password${isForced ? '?forced=1' : ''}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: currentPassword || undefined,
            newPassword,
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reset password')
      }

      toast.success('Password updated successfully')

      // For forced reset, redirect to the role-based home page
      // For self-initiated reset, redirect to /account/profile
      try {
        const sessRes = await fetch('/api/auth/session')
        if (sessRes.ok) {
          const sessData = await sessRes.json()
          const role = sessData?.user?.role || 'customer'
          if (isForced) {
            router.push(getRoleBasedRedirect(role))
          } else {
            router.push('/account/profile')
          }
          router.refresh()
          return
        }
      } catch {
        // fall through
      }
      router.push('/')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isForced ? 'Set a new password' : 'Change your password'}
          </CardTitle>
          <CardDescription>
            {isForced
              ? 'You\'re using a temporary password. Please set your own password to continue.'
              : 'Choose a strong, memorable password for your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isForced && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  This is your first login. You must set a new password before continuing.
                </span>
              </div>
            )}

            {!isForced && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="currentPassword"
                    type={showCurrent ? 'text' : 'password'}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pl-9 pr-10 h-11"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  placeholder="Min 8 chars, with letters and numbers"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-10 h-11"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${newPassword.length >= 8 ? 'text-green-500' : 'text-gray-300'}`} />
                  <span>8+ characters</span>
                  <CheckCircle2 className={`h-3.5 w-3.5 ml-2 ${/[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'text-green-500' : 'text-gray-300'}`} />
                  <span>letters + numbers</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showNew ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 h-11"
                  required
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 font-semibold"
              disabled={saving}
            >
              {saving ? 'Saving...' : isForced ? 'Set New Password & Continue' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
        {!isForced && (
          <CardFooter className="justify-center">
            <Link href="/account/profile" className="text-sm text-[#16a34a] font-medium hover:underline">
              Back to profile
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
