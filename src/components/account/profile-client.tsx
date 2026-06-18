'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User as UserIcon, Mail, Phone, Lock, Save, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { getRoleBasedRedirect } from '@/lib/auth-client'
import type { ServerUser } from '@/lib/auth/server'

const roleLabels: Record<string, string> = {
  OWNER: 'Store Owner',
  MANAGER: 'Manager',
  DRIVER: 'Driver',
  PICKER: 'Picker',
  CUSTOMER: 'Customer',
}

const roleColors: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  DRIVER: 'bg-orange-100 text-orange-700',
  PICKER: 'bg-green-100 text-green-700',
  CUSTOMER: 'bg-gray-100 text-gray-700',
}

interface ProfileClientProps {
  user: ServerUser
}

export function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter()
  const [name, setName] = useState(user.name || '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [mustReset, setMustReset] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/user/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setName(data.user.name || '')
          setPhone(data.user.phone || '')
          setEmail(data.user.email)
          setRole(data.user.role)
          setMustReset(data.user.mustResetPassword === true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success('Profile updated')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const dashboardLink = getRoleBasedRedirect(role)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href={dashboardLink}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {role === 'CUSTOMER' ? 'account' : 'dashboard'}
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white">
            <UserIcon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{name || 'My Profile'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-xs ${roleColors[role] || 'bg-gray-100 text-gray-700'}`}>
                {roleLabels[role] || role}
              </Badge>
              {mustReset && (
                <Badge className="text-xs bg-amber-100 text-amber-700">
                  Password reset required
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Personal details card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-gray-500" />
              Personal Details
            </CardTitle>
            <CardDescription>
              Update your name and phone number. Email can only be changed by the store owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  value={email}
                  readOnly
                  disabled
                  className="pl-9 h-11 bg-gray-50 text-gray-500"
                />
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Email changes must be made by the store owner.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., +44 7123 456789"
                  className="pl-9 h-11"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(dashboardLink)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-[#16a34a] hover:bg-[#15803d] text-white"
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" /> Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Password card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-gray-500" />
              Password
            </CardTitle>
            <CardDescription>
              Change your password. You'll need to enter your current password to confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mustReset && (
              <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Your account is using a temporary password. Please set a new password to secure your account.
                </span>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.push('/auth/reset-password')}
            >
              <KeyRound className="h-4 w-4 mr-1" /> Change Password
            </Button>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <p className="text-xs text-gray-500 text-center">
          For security, only you can edit your personal details. The store owner can change your email.
        </p>
      </div>
    </div>
  )
}
