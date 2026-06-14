'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  User,
  Mail,
  Phone,
  Save,
  Shield,
} from 'lucide-react'

interface PickerProfile {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: string
  createdAt: string
}

export function PickerProfileClient() {
  const [profile, setProfile] = useState<PickerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/picker/profile')
      .then((res) => res.json())
      .then((data) => {
        setProfile(data.user)
        setPhone(data.user?.phone || '')
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      const res = await fetch('/api/picker/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data.user || { ...profile, phone })
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32" />
        ))}
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Failed to load profile</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

      {/* Role Badge */}
      <Card className="bg-orange-50 border-orange-200">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-orange-500" />
          <div>
            <p className="font-semibold text-orange-900 text-sm">Picker</p>
            <p className="text-xs text-orange-700">Warehouse picking and packing role</p>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-900">{profile.name || 'Not set'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-900">{profile.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Member since {new Date(profile.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </CardContent>
      </Card>

      {/* Phone Number */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </CardTitle>
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
                className="h-9 text-xs"
              >
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="phone" className="text-xs">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 07700 900000"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPhone(profile.phone || '')
                    setEditing(false)
                  }}
                  className="flex-1 h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white h-10"
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-900">{profile.phone || 'Not set'}</p>
          )}
        </CardContent>
      </Card>

      {/* Save notification */}
      {saved && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#16a34a] text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 z-50">
          <Save className="h-4 w-4" />
          Profile saved!
        </div>
      )}
    </div>
  )
}
