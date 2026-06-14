'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Phone, Mail, Building2, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface StoreProfile {
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
}

export function StoreProfileEditor() {
  const [profile, setProfile] = useState<StoreProfile>({
    name: '',
    address: '',
    latitude: null,
    longitude: null,
    phone: '',
    email: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/admin/store/profile')
      if (res.ok) {
        const data = await res.json()
        if (data.store) {
          setProfile({
            name: data.store.name || '',
            address: data.store.address || '',
            latitude: data.store.latitude ?? null,
            longitude: data.store.longitude ?? null,
            phone: data.store.phone || '',
            email: data.store.email || '',
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch store profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile.name.trim()) {
      toast.error('Store name is required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/store/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name.trim(),
          address: profile.address.trim(),
          latitude: profile.latitude,
          longitude: profile.longitude,
          phone: profile.phone?.trim() || null,
          email: profile.email?.trim() || null,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Store profile updated successfully')
        // Refresh the store info context so navbar/footer update immediately
        try {
          await fetch('/api/store/info')
        } catch {
          // Non-critical
        }
      } else {
        toast.error(data.error || 'Failed to update store profile')
      }
    } catch (err) {
      toast.error('Network error — please try again')
      console.error('Failed to save store profile:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading store profile...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#16a34a]" />
          Store Profile
        </CardTitle>
        <CardDescription>
          Update your store name, address, and contact details. Changes will reflect across the entire website.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Store Name */}
        <div className="space-y-2">
          <Label htmlFor="store-name" className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            Store Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="store-name"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            placeholder="e.g., Fresh Mart London"
            className="max-w-md"
          />
          <p className="text-xs text-gray-500">This name appears in the navbar, footer, and throughout the website.</p>
        </div>

        {/* Store Address */}
        <div className="space-y-2">
          <Label htmlFor="store-address" className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            Store Address
          </Label>
          <Input
            id="store-address"
            value={profile.address}
            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            placeholder="e.g., 123 High Street, Lewisham, London, SE13 6LG"
            className="max-w-lg"
          />
          <p className="text-xs text-gray-500">Full address shown in the footer and delivery map.</p>
        </div>

        {/* Latitude & Longitude */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="store-lat" className="text-sm font-medium">Latitude</Label>
            <Input
              id="store-lat"
              type="number"
              step="any"
              value={profile.latitude ?? ''}
              onChange={(e) => setProfile({ ...profile, latitude: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="e.g., 51.4612"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-lng" className="text-sm font-medium">Longitude</Label>
            <Input
              id="store-lng"
              type="number"
              step="any"
              value={profile.longitude ?? ''}
              onChange={(e) => setProfile({ ...profile, longitude: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="e.g., -0.0117"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-3">Used for the delivery map and distance calculations. Find your coordinates at <a href="https://www.latlong.net/" target="_blank" rel="noopener noreferrer" className="text-[#16a34a] hover:underline">latlong.net</a>.</p>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="store-phone" className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            Phone Number
          </Label>
          <Input
            id="store-phone"
            value={profile.phone ?? ''}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="e.g., +44 20 1234 5678"
            className="max-w-sm"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="store-email" className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-400" />
            Contact Email
          </Label>
          <Input
            id="store-email"
            type="email"
            value={profile.email ?? ''}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            placeholder="e.g., hello@yourstore.co.uk"
            className="max-w-sm"
          />
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#16a34a] hover:bg-[#15803d] text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
