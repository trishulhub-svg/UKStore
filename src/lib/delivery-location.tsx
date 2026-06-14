'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { calculateDistance } from '@/lib/delivery'
import { useStoreInfo } from '@/lib/store-info'

// ─── Types ────────────────────────────────────────────────────

export interface UserLocation {
  /** Source of the location data */
  source: 'gps' | 'postcode' | 'manual' | 'none'
  /** User's latitude */
  latitude: number | null
  /** User's longitude */
  longitude: number | null
  /** Postcode if entered manually */
  postcode: string | null
  /** Full address if entered manually */
  address: string | null
  /** Distance from store in km (calculated) */
  distanceKm: number | null
  /** Whether location is within store delivery radius */
  isWithinDeliveryZone: boolean
  /** Whether we've attempted to get location */
  locationAttempted: boolean
}

interface DeliveryLocationContextType {
  location: UserLocation
  /** Set location from GPS coordinates */
  setGpsLocation: (lat: number, lng: number) => void
  /** Set location from postcode geocoding result */
  setPostcodeLocation: (postcode: string, lat: number, lng: number) => void
  /** Set location from a full address (checkout) */
  setManualAddress: (address: string, postcode: string, lat: number, lng: number) => void
  /** Clear the current location */
  clearLocation: () => void
  /** Recalculate distance (e.g. after store info loads) */
  recalculate: () => void
}

const DEFAULT_LOCATION: UserLocation = {
  source: 'none',
  latitude: null,
  longitude: null,
  postcode: null,
  address: null,
  distanceKm: null,
  isWithinDeliveryZone: false,
  locationAttempted: false,
}

const DeliveryLocationContext = createContext<DeliveryLocationContextType>({
  location: DEFAULT_LOCATION,
  setGpsLocation: () => {},
  setPostcodeLocation: () => {},
  setManualAddress: () => {},
  clearLocation: () => {},
  recalculate: () => {},
})

export function useDeliveryLocation() {
  return useContext(DeliveryLocationContext)
}

// ─── Storage keys ─────────────────────────────────────────────

const STORAGE_KEY_LAT = 'delivery_lat'
const STORAGE_KEY_LNG = 'delivery_lng'
const STORAGE_KEY_POSTCODE = 'delivery_postcode'
const STORAGE_KEY_SOURCE = 'delivery_source'
const STORAGE_KEY_ADDRESS = 'delivery_address'

function persistLocation(loc: UserLocation) {
  if (typeof window === 'undefined') return
  try {
    if (loc.latitude !== null) localStorage.setItem(STORAGE_KEY_LAT, String(loc.latitude))
    else localStorage.removeItem(STORAGE_KEY_LAT)

    if (loc.longitude !== null) localStorage.setItem(STORAGE_KEY_LNG, String(loc.longitude))
    else localStorage.removeItem(STORAGE_KEY_LNG)

    if (loc.postcode) localStorage.setItem(STORAGE_KEY_POSTCODE, loc.postcode)
    else localStorage.removeItem(STORAGE_KEY_POSTCODE)

    if (loc.source !== 'none') localStorage.setItem(STORAGE_KEY_SOURCE, loc.source)
    else localStorage.removeItem(STORAGE_KEY_SOURCE)

    if (loc.address) localStorage.setItem(STORAGE_KEY_ADDRESS, loc.address)
    else localStorage.removeItem(STORAGE_KEY_ADDRESS)
  } catch {
    // localStorage may be unavailable
  }
}

function loadPersistedLocation(): Partial<UserLocation> {
  if (typeof window === 'undefined') return {}
  try {
    const lat = localStorage.getItem(STORAGE_KEY_LAT)
    const lng = localStorage.getItem(STORAGE_KEY_LNG)
    const postcode = localStorage.getItem(STORAGE_KEY_POSTCODE)
    const source = localStorage.getItem(STORAGE_KEY_SOURCE) as UserLocation['source'] | null
    const address = localStorage.getItem(STORAGE_KEY_ADDRESS)

    if (lat && lng) {
      return {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        postcode,
        source: source || 'postcode',
        address,
        locationAttempted: true,
      }
    }
    // If only postcode stored (old format), we'll re-geocode it
    if (postcode) {
      return {
        postcode,
        source: source || 'postcode',
        locationAttempted: true,
      }
    }
  } catch {
    // Ignore
  }
  return {}
}

// ─── Provider ─────────────────────────────────────────────────

export function DeliveryLocationProvider({ children }: { children: ReactNode }) {
  const { store } = useStoreInfo()
  const [location, setLocation] = useState<UserLocation>(() => {
    const persisted = loadPersistedLocation()
    return { ...DEFAULT_LOCATION, ...persisted }
  })

  // Recalculate distance whenever store or location changes
  const computeDistance = useCallback(
    (lat: number | null, lng: number | null): { distanceKm: number | null; isWithinDeliveryZone: boolean } => {
      if (lat === null || lng === null || !store) {
        return { distanceKm: null, isWithinDeliveryZone: false }
      }
      if (store.latitude === 0 && store.longitude === 0) {
        // Store coordinates not configured — allow delivery by default
        return { distanceKm: null, isWithinDeliveryZone: true }
      }
      const dist = calculateDistance(store.latitude, store.longitude, lat, lng)
      const within = dist <= store.delivery_radius_km
      return { distanceKm: Math.round(dist * 10) / 10, isWithinDeliveryZone: within }
    },
    [store]
  )

  // Effect: recalculate when store info becomes available
  useEffect(() => {
    if (!store) return
    if (location.latitude !== null && location.longitude !== null) {
      const { distanceKm, isWithinDeliveryZone } = computeDistance(location.latitude, location.longitude)
      setLocation((prev) => ({ ...prev, distanceKm, isWithinDeliveryZone }))
    }
  }, [store, location.latitude, location.longitude, computeDistance])

  // On mount, if we have a postcode but no lat/lng, re-geocode it
  useEffect(() => {
    if (location.postcode && (location.latitude === null || location.longitude === null)) {
      geocodePostcode(location.postcode).then((result) => {
        if (result) {
          const { distanceKm, isWithinDeliveryZone } = computeDistance(result.latitude, result.longitude)
          const newLoc: UserLocation = {
            ...location,
            latitude: result.latitude,
            longitude: result.longitude,
            distanceKm,
            isWithinDeliveryZone,
          }
          setLocation(newLoc)
          persistLocation(newLoc)
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setGpsLocation = useCallback(
    (lat: number, lng: number) => {
      const { distanceKm, isWithinDeliveryZone } = computeDistance(lat, lng)
      const newLoc: UserLocation = {
        source: 'gps',
        latitude: lat,
        longitude: lng,
        postcode: location.postcode,
        address: null,
        distanceKm,
        isWithinDeliveryZone,
        locationAttempted: true,
      }
      setLocation(newLoc)
      persistLocation(newLoc)
    },
    [computeDistance, location.postcode]
  )

  const setPostcodeLocation = useCallback(
    (postcode: string, lat: number, lng: number) => {
      const { distanceKm, isWithinDeliveryZone } = computeDistance(lat, lng)
      const newLoc: UserLocation = {
        source: 'postcode',
        latitude: lat,
        longitude: lng,
        postcode,
        address: null,
        distanceKm,
        isWithinDeliveryZone,
        locationAttempted: true,
      }
      setLocation(newLoc)
      persistLocation(newLoc)
    },
    [computeDistance]
  )

  const setManualAddress = useCallback(
    (address: string, postcode: string, lat: number, lng: number) => {
      const { distanceKm, isWithinDeliveryZone } = computeDistance(lat, lng)
      const newLoc: UserLocation = {
        source: 'manual',
        latitude: lat,
        longitude: lng,
        postcode,
        address,
        distanceKm,
        isWithinDeliveryZone,
        locationAttempted: true,
      }
      setLocation(newLoc)
      persistLocation(newLoc)
    },
    [computeDistance]
  )

  const clearLocation = useCallback(() => {
    setLocation(DEFAULT_LOCATION)
    persistLocation(DEFAULT_LOCATION)
  }, [])

  const recalculate = useCallback(() => {
    if (location.latitude !== null && location.longitude !== null) {
      const { distanceKm, isWithinDeliveryZone } = computeDistance(location.latitude, location.longitude)
      setLocation((prev) => ({ ...prev, distanceKm, isWithinDeliveryZone }))
    }
  }, [location.latitude, location.longitude, computeDistance])

  return (
    <DeliveryLocationContext.Provider
      value={{ location, setGpsLocation, setPostcodeLocation, setManualAddress, clearLocation, recalculate }}
    >
      {children}
    </DeliveryLocationContext.Provider>
  )
}

// ─── Geocoding helper ─────────────────────────────────────────

/**
 * Geocode a UK postcode using postcodes.io (free, no API key needed).
 * Returns { latitude, longitude } or null on failure.
 */
export async function geocodePostcode(postcode: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const cleaned = postcode.trim().replace(/\s+/g, '')
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status === 200 && data.result) {
      return {
        latitude: data.result.latitude,
        longitude: data.result.longitude,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Geocode a full address string using our server-side API (which can use Google Maps or fallback).
 * Returns { latitude, longitude } or null on failure.
 */
export async function geocodeAddress(address: string, postcode: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // First try postcode geocoding (more reliable for UK)
    if (postcode) {
      const pcResult = await geocodePostcode(postcode)
      if (pcResult) return pcResult
    }

    // Fallback: try our server-side geocoding API
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, postcode }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.latitude && data.longitude) {
      return { latitude: data.latitude, longitude: data.longitude }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Request browser geolocation. Returns { latitude, longitude } or null on failure/denial.
 */
export function requestBrowserLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => {
        // User denied or error
        resolve(null)
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 min cache
      }
    )
  })
}
