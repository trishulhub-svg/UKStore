'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Phone, Mail, Building2, Save, Loader2, ImagePlus, X, Search, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { validateImageFile, fileToDataUrl } from '@/lib/upload'
import { apiFetch } from '@/lib/api-fetch'

interface StoreProfile {
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  logoUrl: string | null
}

export function StoreProfileEditor() {
  const [profile, setProfile] = useState<StoreProfile>({
    name: '',
    address: '',
    latitude: null,
    longitude: null,
    phone: '',
    email: '',
    logoUrl: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  // Geocoding state for the address → lat/lng auto-fill flow.
  // `geocoding` is true while a lookup is in flight; `geocodeSource` is a
  // short human-readable string (e.g. "postcodes.io" or "OpenStreetMap")
  // shown under the inputs so the user knows where the coordinates came
  // from. `geocodeError` is set if the lookup fails.
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeSource, setGeocodeSource] = useState<string | null>(null)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  // Debounce timer ref — keeps us from firing a lookup on every keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track the address value at the time of the last successful geocode so
  // we can re-trigger when the user meaningfully changes the address.
  const lastGeocodedAddressRef = useRef<string>('')

  useEffect(() => {
    fetchProfile()
  }, [])

  // Cleanup the debounce timer if the component unmounts mid-typing.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  /**
   * Call the server-side /api/geocode endpoint with the current address
   * and populate the latitude/longitude fields on success. The inputs are
   * read-only — this is the ONLY way coordinates get entered now.
   *
   * Resolution order on the server: postcodes.io (for the postcode portion)
   * → OpenStreetMap Nominatim (for the full free-form address, worldwide).
   */
  const geocodeAddress = async (address: string) => {
    const trimmed = address.trim()
    if (trimmed.length < 5) {
      // Too short to geocode — clear any previous coords and bail out
      // without showing an error (the user is still typing).
      setProfile((prev) => ({ ...prev, latitude: null, longitude: null }))
      setGeocodeSource(null)
      setGeocodeError(null)
      lastGeocodedAddressRef.current = ''
      return
    }

    setGeocoding(true)
    setGeocodeError(null)
    try {
      // Try to extract a UK postcode from the address string — gives
      // postcodes.io the best chance to return a high-accuracy result.
      const pcMatch = trimmed.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)
      const postcode = pcMatch ? pcMatch[0] : ''

      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed, postcode }),
      })

      if (res.ok) {
        const data = await res.json()
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          setProfile((prev) => ({
            ...prev,
            latitude: data.latitude,
            longitude: data.longitude,
          }))
          setGeocodeSource(data.source === 'nominatim' ? 'OpenStreetMap' : (data.source || 'geocoder'))
          lastGeocodedAddressRef.current = trimmed
          setGeocodeError(null)
          // Subtle confirmation toast — non-blocking, doesn't interrupt typing.
          toast.success(`Coordinates found via ${data.source === 'nominatim' ? 'OpenStreetMap' : data.source}`, {
            description: `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`,
            duration: 2500,
          })
          return
        }
      }

      // Geocoding failed — show an inline error under the inputs and leave
      // any existing coordinates alone (the user might be mid-edit).
      setGeocodeError('Could not find coordinates for this address. Try including a postcode.')
      toast.error('Could not auto-find coordinates', {
        description: 'Try adding a postcode, or check the address for typos.',
        duration: 3500,
      })
    } catch {
      setGeocodeError('Network error while looking up coordinates.')
    } finally {
      setGeocoding(false)
    }
  }

  /**
   * Debounced geocode trigger — fired when the user types in the address
   * field. Waits 900ms after the last keystroke so we don't spam the API
   * while the user is still typing out the full address.
   *
   * We also skip the call if the address hasn't meaningfully changed since
   * the last successful geocode (avoids re-geocoding after trivial edits
   * like trailing whitespace).
   */
  const handleAddressChange = (value: string) => {
    setProfile((prev) => ({ ...prev, address: value }))
    setGeocodeError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim()
      if (trimmed === lastGeocodedAddressRef.current) return
      geocodeAddress(trimmed)
    }, 900)
  }

  /**
   * Immediate geocode on blur — if the user tabs/clicks away from the
   * address field, cancel any pending debounce and geocode right now so
   * the coords are populated by the time they move to the next input.
   */
  const handleAddressBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const trimmed = profile.address.trim()
    if (trimmed && trimmed !== lastGeocodedAddressRef.current) {
      geocodeAddress(trimmed)
    }
  }

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/api/admin/store/profile')
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
            logoUrl: data.store.logoUrl || null,
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
      const res = await apiFetch('/api/admin/store/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name.trim(),
          address: profile.address.trim(),
          // Send lat/lng only if they have a real value. The DB columns are
          // NOT NULL, so sending null would cause a 500. The API now also
          // skips null/empty values defensively, but doing it client-side
          // too means the request body matches what will actually be saved.
          ...(profile.latitude != null && !isNaN(profile.latitude)
            ? { latitude: profile.latitude }
            : {}),
          ...(profile.longitude != null && !isNaN(profile.longitude)
            ? { longitude: profile.longitude }
            : {}),
          phone: profile.phone?.trim() || null,
          email: profile.email?.trim() || null,
          logoUrl: profile.logoUrl,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Store profile updated successfully')
        // Refresh the store info context so navbar/footer/favicon update immediately.
        // Trigger a full page refresh so the dynamic favicon (served by /icon route) reloads too.
        try {
          await apiFetch('/api/store/info', { cache: 'no-store', redirectOn401: false })
        } catch {
          // Non-critical
        }
        // Small delay so the new favicon has time to be regenerated
        setTimeout(() => window.location.reload(), 800)
      } else {
        // Server returned a non-OK response with a parseable body.
        // Show the specific error from the API (e.g., "Latitude must be between -90 and 90")
        // or fall back to the generic message. In dev, the API also returns `details`.
        const errMsg = data.details || data.error || 'Failed to update store profile'
        toast.error(errMsg)
      }
    } catch (err) {
      // apiFetch throws 'Session expired — redirecting to login' on 401 (after
      // triggering the redirect). In that case, show a clear session-expired
      // toast and let the redirect happen — do NOT show "Network error".
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'Session expired — redirecting to login') {
        toast.info('Your session has expired. Redirecting to login...')
      } else {
        toast.error('Network error — please try again')
        console.error('Failed to save store profile:', err)
      }
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
          <div className="flex gap-2 max-w-lg">
            <Input
              id="store-address"
              value={profile.address}
              onChange={(e) => handleAddressChange(e.target.value)}
              onBlur={handleAddressBlur}
              placeholder="e.g., 123 High Street, Lewisham, London, SE13 6LG"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => geocodeAddress(profile.address)}
              disabled={geocoding || profile.address.trim().length < 5}
              aria-label="Find coordinates from address"
              className="flex-shrink-0"
              title="Find coordinates from address"
            >
              {geocoding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Full address shown in the footer and delivery map. Enter the full address
            (ideally with a postcode) and the coordinates below will be filled in
            automatically.
          </p>
        </div>

        {/* Latitude & Longitude — read-only, auto-populated from the address */}
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="store-lat" className="text-sm font-medium flex items-center gap-1.5">
                Latitude
                <Lock className="h-3 w-3 text-gray-400" aria-label="Auto-filled, read-only" />
              </Label>
              <Input
                id="store-lat"
                type="number"
                step="any"
                value={profile.latitude ?? ''}
                readOnly
                placeholder="Auto-filled from address"
                className="bg-gray-50 text-gray-700 cursor-not-allowed focus:bg-gray-50"
                tabIndex={-1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-lng" className="text-sm font-medium flex items-center gap-1.5">
                Longitude
                <Lock className="h-3 w-3 text-gray-400" aria-label="Auto-filled, read-only" />
              </Label>
              <Input
                id="store-lng"
                type="number"
                step="any"
                value={profile.longitude ?? ''}
                readOnly
                placeholder="Auto-filled from address"
                className="bg-gray-50 text-gray-700 cursor-not-allowed focus:bg-gray-50"
                tabIndex={-1}
              />
            </div>
          </div>
          {/* Status line under the read-only inputs */}
          <div className="text-xs max-w-lg">
            {geocoding ? (
              <p className="text-gray-500 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Looking up coordinates...
              </p>
            ) : geocodeError ? (
              <p className="text-amber-600">{geocodeError}</p>
            ) : geocodeSource && profile.latitude !== null && profile.longitude !== null ? (
              <p className="text-[#16a34a]">
                Auto-filled via {geocodeSource} — used for the delivery map and
                distance calculations.
              </p>
            ) : profile.latitude !== null && profile.longitude !== null ? (
              <p className="text-gray-500">
                Coordinates saved from a previous lookup. Edit the address above
                to refresh them.
              </p>
            ) : (
              <p className="text-gray-500">
                Enter the full address above (with a postcode for best accuracy) —
                coordinates will be filled in automatically.
              </p>
            )}
          </div>
        </div>

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

        {/* Store Logo */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-gray-400" />
            Store Logo
          </Label>
          <p className="text-xs text-gray-500">
            Upload your store's logo. It will appear in the navbar, footer, admin sidebar, driver/picker apps, and as the browser favicon.
            Recommended: square PNG or WebP, max 2MB.
          </p>
          <div className="flex items-start gap-4 mt-2">
            {/* Preview */}
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
              {profile.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt="Store logo preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-gray-300 text-xs text-center px-2">No logo<br />uploaded</div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="logo-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 text-sm text-[#16a34a] hover:text-[#15803d] font-medium px-3 py-2 border border-[#16a34a]/30 rounded-md hover:bg-[#16a34a]/5 transition-colors">
                  <ImagePlus className="h-4 w-4" />
                  {profile.logoUrl ? 'Change Logo' : 'Upload Logo'}
                </div>
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const err = validateImageFile(file, 2)
                    if (err) { toast.error(err); return }
                    setUploadingLogo(true)
                    try {
                      const dataUrl = await fileToDataUrl(file)
                      setProfile({ ...profile, logoUrl: dataUrl })
                      toast.success('Logo ready — click Save Changes to apply')
                    } catch (err: any) {
                      if (err?.message !== 'Session expired — redirecting to login') {
                        toast.error('Failed to process logo')
                      }

                    } finally {
                      setUploadingLogo(false)
                    }
                  }}
                />
              </label>
              {uploadingLogo && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing...
                </p>
              )}
              {profile.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                  onClick={() => setProfile({ ...profile, logoUrl: null })}
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove Logo
                </Button>
              )}
            </div>
          </div>
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
