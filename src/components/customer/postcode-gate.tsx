'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, Navigation, ArrowRight, AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useStoreInfo } from '@/lib/store-info'
import { useDeliveryLocation, geocodePostcode, requestBrowserLocation } from '@/lib/delivery-location'

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

interface PostcodeGateProps {
  /** Called once the location is verified and within delivery zone */
  onVerified: (postcode: string) => void
  /** The currently saved postcode (if any), so the parent can display it */
  savedPostcode?: string | null
}

type VerificationStatus = 'idle' | 'locating' | 'geocoding' | 'checking' | 'in_zone' | 'out_of_zone'

export function PostcodeGate({ onVerified, savedPostcode }: PostcodeGateProps) {
  const [postcode, setPostcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { store: storeInfo } = useStoreInfo()
  const deliveryLocation = useDeliveryLocation()
  const storeName = storeInfo?.name || 'Fresh Mart'
  const deliveryRadius = storeInfo?.delivery_radius_km || 5

  const [isSlidingOut, setIsSlidingOut] = useState(false)
  const [locallyDismissed, setLocallyDismissed] = useState(false)
  const [status, setStatus] = useState<VerificationStatus>('idle')
  const [distanceResult, setDistanceResult] = useState<{ km: number; withinZone: boolean } | null>(null)

  // Derive hidden state from props + local animation state
  const isHidden = (!!savedPostcode && !isSlidingOut) || locallyDismissed

  const handleUseMyLocation = useCallback(async () => {
    setError(null)
    setStatus('locating')

    const gpsLocation = await requestBrowserLocation()

    if (!gpsLocation) {
      setError('Could not access your location. Please enter your postcode manually.')
      setStatus('idle')
      return
    }

    setStatus('checking')

    // Use the delivery location context to set GPS location and compute distance
    deliveryLocation.setGpsLocation(gpsLocation.latitude, gpsLocation.longitude)

    // Wait a tick for the context to update, then check
    // The context will compute the distance asynchronously
    const storeLat = storeInfo?.latitude
    const storeLng = storeInfo?.longitude

    if (storeLat !== undefined && storeLng !== undefined && storeLat !== 0 && storeLng !== 0) {
      // Calculate distance inline since context update is async
      const R = 6371
      const dLat = ((gpsLocation.latitude - storeLat) * Math.PI) / 180
      const dLon = ((gpsLocation.longitude - storeLng) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((storeLat * Math.PI) / 180) *
          Math.cos((gpsLocation.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const dist = R * c
      const rounded = Math.round(dist * 10) / 10
      const within = rounded <= deliveryRadius

      setDistanceResult({ km: rounded, withinZone: within })

      if (within) {
        setStatus('in_zone')
        // Trigger slide-out animation after brief success display
        setTimeout(() => {
          setIsSlidingOut(true)
          setTimeout(() => {
            setLocallyDismissed(true)
            onVerified('GPS Location')
          }, 500)
        }, 800)
      } else {
        setStatus('out_of_zone')
      }
    } else {
      // Store coordinates not configured — allow by default
      setDistanceResult({ km: 0, withinZone: true })
      setStatus('in_zone')
      setTimeout(() => {
        setIsSlidingOut(true)
        setTimeout(() => {
          setLocallyDismissed(true)
          onVerified('GPS Location')
        }, 500)
      }, 800)
    }
  }, [storeInfo, deliveryLocation, deliveryRadius, onVerified])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus('idle')
    setDistanceResult(null)

    const trimmed = postcode.trim().toUpperCase()

    if (!trimmed) {
      setError('Please enter a postcode')
      return
    }

    if (!UK_POSTCODE_REGEX.test(trimmed)) {
      setError('Please enter a valid UK postcode (e.g., SW1A 1AA)')
      return
    }

    setStatus('geocoding')

    // Geocode the postcode to get lat/lng
    const geoResult = await geocodePostcode(trimmed)

    if (!geoResult) {
      setError('Could not find this postcode. Please check and try again.')
      setStatus('idle')
      return
    }

    setStatus('checking')

    // Set the location in context
    deliveryLocation.setPostcodeLocation(trimmed, geoResult.latitude, geoResult.longitude)

    // Calculate distance
    const storeLat = storeInfo?.latitude
    const storeLng = storeInfo?.longitude

    if (storeLat !== undefined && storeLng !== undefined && storeLat !== 0 && storeLng !== 0) {
      const R = 6371
      const dLat = ((geoResult.latitude - storeLat) * Math.PI) / 180
      const dLon = ((geoResult.longitude - storeLng) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((storeLat * Math.PI) / 180) *
          Math.cos((geoResult.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const dist = R * c
      const rounded = Math.round(dist * 10) / 10
      const within = rounded <= deliveryRadius

      setDistanceResult({ km: rounded, withinZone: within })

      if (within) {
        setStatus('in_zone')
        // Save postcode to localStorage for backward compat
        try { localStorage.setItem('delivery_postcode', trimmed) } catch {}
        // Trigger slide-out animation after brief success display
        setTimeout(() => {
          setIsSlidingOut(true)
          setTimeout(() => {
            setLocallyDismissed(true)
            onVerified(trimmed)
          }, 500)
        }, 800)
      } else {
        setStatus('out_of_zone')
      }
    } else {
      // Store coordinates not configured — allow by default
      setDistanceResult({ km: 0, withinZone: true })
      setStatus('in_zone')
      try { localStorage.setItem('delivery_postcode', trimmed) } catch {}
      setTimeout(() => {
        setIsSlidingOut(true)
        setTimeout(() => {
          setLocallyDismissed(true)
          onVerified(trimmed)
        }, 500)
      }, 800)
    }
  }, [postcode, storeInfo, deliveryLocation, deliveryRadius, onVerified])

  const handleInputChange = (value: string) => {
    setPostcode(value)
    if (error) setError(null)
    if (status !== 'idle') setStatus('idle')
    if (distanceResult) setDistanceResult(null)
  }

  const handleTryDifferentPostcode = () => {
    setStatus('idle')
    setDistanceResult(null)
    setError(null)
  }

  // Already verified — render nothing
  if (isHidden) return null

  const isProcessing = status === 'locating' || status === 'geocoding' || status === 'checking'

  return (
    <div
      className={`fixed inset-0 z-[100] bg-white flex items-center justify-center transition-all duration-500 ease-in-out ${
        isSlidingOut
          ? 'opacity-0 translate-y-[-20px] pointer-events-none'
          : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="w-full max-w-md mx-auto px-6 text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#16a34a] mb-4">
            <MapPin className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {storeName}
          </h1>
        </div>

        {/* Success State */}
        {status === 'in_zone' && distanceResult && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-700 mb-2">We Deliver to You!</h2>
            <p className="text-sm text-gray-500">
              You&apos;re {distanceResult.km}km away — within our {deliveryRadius}km delivery zone.
            </p>
          </div>
        )}

        {/* Out of Zone State */}
        {status === 'out_of_zone' && distanceResult && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Outside Delivery Zone</h2>
            <p className="text-sm text-gray-600 mb-1">
              You&apos;re <strong>{distanceResult.km}km</strong> away from our store.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              We only deliver within a <strong>{deliveryRadius}km</strong> radius.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Try entering a different postcode or delivery address that might be closer to our store.
            </p>

            {/* Still allow them to enter a different postcode */}
            <div className="space-y-3">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    value={postcode}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Try a different postcode"
                    className="h-12 pl-12 pr-4 text-base rounded-xl border-gray-300 focus:border-[#16a34a] focus:ring-[#16a34a] shadow-sm"
                    autoFocus
                    aria-label="UK Postcode"
                    autoComplete="postal-code"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold text-base rounded-xl shadow-md transition-all duration-200 hover:shadow-lg"
                >
                  Check Another Postcode
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
              <Button
                variant="outline"
                onClick={handleTryDifferentPostcode}
                className="w-full rounded-xl"
              >
                Use My Device Location Instead
              </Button>
            </div>

            <p className="mt-6 text-xs text-gray-400">
              Our delivery area is centred on our store location. If you think this is an error, please contact us.
            </p>
          </div>
        )}

        {/* Default Form State */}
        {(status === 'idle' || isProcessing) && (
          <>
            {/* Headline */}
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 leading-snug">
              Fresh groceries delivered to your doorstep in minutes.
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Check if we deliver to your area. Enter your postcode or use your device location.
            </p>

            {/* Use My Location Button */}
            <Button
              variant="outline"
              onClick={handleUseMyLocation}
              disabled={status === 'locating'}
              className="w-full h-12 mb-4 border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white font-semibold text-base rounded-xl transition-all duration-200"
            >
              {status === 'locating' ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Detecting Your Location...
                </>
              ) : (
                <>
                  <Navigation className="mr-2 h-5 w-5" />
                  Use My Current Location
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Postcode Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  value={postcode}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Enter your UK Postcode (e.g., SW1A 1AA)"
                  className="h-14 pl-12 pr-4 text-base rounded-xl border-gray-300 focus:border-[#16a34a] focus:ring-[#16a34a] shadow-sm"
                  autoFocus
                  aria-label="UK Postcode"
                  autoComplete="postal-code"
                  disabled={status === 'geocoding' || status === 'checking'}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={status === 'geocoding' || status === 'checking'}
                className="w-full h-14 bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold text-base rounded-xl shadow-md transition-all duration-200 hover:shadow-lg"
              >
                {status === 'geocoding' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Finding Location...
                  </>
                ) : status === 'checking' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Checking Delivery Zone...
                  </>
                ) : (
                  <>
                    Check Availability
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Helper text */}
            <p className="mt-6 text-xs text-gray-400">
              We deliver within {deliveryRadius}km of our store. Your postcode helps us confirm delivery availability and calculate fees.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Read the saved delivery postcode from localStorage.
 * Returns null if not set.
 */
export function getSavedPostcode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('delivery_postcode')
  } catch {
    return null
  }
}

/**
 * Clear the saved delivery postcode, which will re-show the gate.
 */
export function clearSavedPostcode(): void {
  try {
    localStorage.removeItem('delivery_postcode')
    localStorage.removeItem('delivery_lat')
    localStorage.removeItem('delivery_lng')
    localStorage.removeItem('delivery_source')
    localStorage.removeItem('delivery_address')
  } catch {
    // Ignore
  }
}
