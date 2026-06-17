'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MapPin,
  Clock,
  ShoppingCart,
  Store,
  User,
  LogOut,
  LogIn,
  UserPlus,
  Menu,
  X,
  Navigation,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/vat'
import { authGetSession, authLogout, type AuthUser } from '@/lib/auth-client'
import { AuthModal } from '@/components/auth/auth-modal'
import { PredictiveSearch } from '@/components/customer/predictive-search'
import { useStoreInfo } from '@/lib/store-info'
import { useDeliveryLocation, geocodePostcode, requestBrowserLocation } from '@/lib/delivery-location'
import { StoreLogo } from '@/components/layout/store-logo'
import { toast } from 'sonner'

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
const POSTCODE_STORAGE_KEY = 'delivery_postcode'

interface StoreStatus {
  isOpen: boolean
  openingHours: Record<string, { open: string; close: string; closed: boolean }> | null
  name: string
}

export function Navbar() {
  const router = useRouter()
  const getTotalItems = useCartStore((state) => state.getTotalItems)
  const getTotalPrice = useCartStore((state) => state.getTotalPrice)
  const [itemCount, setItemCount] = useState(0)
  const [totalPrice, setTotalPrice] = useState(0)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalView, setAuthModalView] = useState<'login' | 'register'>('login')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Postcode state — initialize from localStorage lazily
  const [postcode, setPostcode] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem(POSTCODE_STORAGE_KEY) || ''
    } catch {
      return ''
    }
  })
  const [postcodeDialogOpen, setPostcodeDialogOpen] = useState(false)
  const [postcodeInput, setPostcodeInput] = useState('')
  const [postcodeError, setPostcodeError] = useState<string | null>(null)
  const [postcodeLoading, setPostcodeLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  // Store info for dynamic name
  const { store: storeInfo } = useStoreInfo()
  const storeName = storeInfo?.name || 'Fresh Mart'

  // Delivery location context
  const deliveryLocation = useDeliveryLocation()
  const { distanceKm, isWithinDeliveryZone, source: locationSource } = deliveryLocation.location
  const hasLocation = deliveryLocation.location.latitude !== null && deliveryLocation.location.longitude !== null

  // Store status for delivery timer
  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null)

  // Subscribe to cart changes
  useEffect(() => {
    const updateCounts = () => {
      setItemCount(getTotalItems())
      setTotalPrice(getTotalPrice())
    }
    updateCounts()
    const unsub = useCartStore.subscribe(updateCounts)
    return unsub
  }, [getTotalItems, getTotalPrice])

  // Check auth
  useEffect(() => {
    authGetSession().then(({ user }) => setUser(user))
  }, [])

  // Fetch store status for delivery timer
  useEffect(() => {
    fetch('/api/store/status')
      .then((r) => r.json())
      .then((data) => setStoreStatus(data))
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await authLogout()
    setUser(null)
    setMobileMenuOpen(false)
    window.location.href = '/'
  }

  const openLogin = () => {
    setAuthModalView('login')
    setAuthModalOpen(true)
    setMobileMenuOpen(false)
  }

  const openRegister = () => {
    setAuthModalView('register')
    setAuthModalOpen(true)
    setMobileMenuOpen(false)
  }

  // Postcode handling with geocoding
  const handlePostcodeSave = async () => {
    const trimmed = postcodeInput.trim().toUpperCase()
    if (!trimmed) {
      setPostcodeError('Please enter a postcode')
      return
    }
    if (!UK_POSTCODE_REGEX.test(trimmed)) {
      setPostcodeError('Please enter a valid UK postcode')
      return
    }

    setPostcodeLoading(true)
    try {
      const geoResult = await geocodePostcode(trimmed)
      if (geoResult) {
        deliveryLocation.setPostcodeLocation(trimmed, geoResult.latitude, geoResult.longitude)
        try { localStorage.setItem(POSTCODE_STORAGE_KEY, trimmed) } catch {}
        setPostcode(trimmed)
        setPostcodeDialogOpen(false)
        setPostcodeInput('')
        setPostcodeError(null)

        // Check if within zone
        const storeLat = storeInfo?.latitude
        const storeLng = storeInfo?.longitude
        const radius = storeInfo?.delivery_radius_km ?? 5
        if (storeLat && storeLng) {
          const R = 6371
          const dLat = ((geoResult.latitude - storeLat) * Math.PI) / 180
          const dLon = ((geoResult.longitude - storeLng) * Math.PI) / 180
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((storeLat * Math.PI) / 180) * Math.cos((geoResult.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const dist = Math.round((R * c) * 10) / 10

          if (dist <= radius) {
            toast.success(`Delivering to ${trimmed} — ${dist}km away`)
          } else {
            toast.error(`${trimmed} is outside our ${radius}km delivery zone`)
          }
        } else {
          toast.success(`Delivering to ${trimmed}`)
        }
      } else {
        setPostcodeError('Could not find this postcode. Please try again.')
      }
    } catch {
      setPostcodeError('Something went wrong. Please try again.')
    } finally {
      setPostcodeLoading(false)
    }
  }

  // GPS location handling
  const handleUseMyLocation = async () => {
    setGpsLoading(true)
    try {
      const gpsLocation = await requestBrowserLocation()
      if (gpsLocation) {
        deliveryLocation.setGpsLocation(gpsLocation.latitude, gpsLocation.longitude)
        setPostcodeDialogOpen(false)
        toast.success('Location detected!')
      } else {
        setPostcodeError('Could not access your location. Please enter your postcode manually.')
      }
    } catch {
      setPostcodeError('Could not access your location. Please enter your postcode manually.')
    } finally {
      setGpsLoading(false)
    }
  }

  // Delivery time calculation
  const getDeliveryMessage = useCallback(() => {
    if (!storeStatus) return { text: 'Loading...', color: 'text-gray-400' }

    if (!storeStatus.isOpen) {
      // Find next opening time
      const now = new Date()
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      const todayKey = dayKeys[now.getDay()]

      if (storeStatus.openingHours) {
        const todayHours = storeStatus.openingHours[todayKey]
        if (todayHours && !todayHours.closed) {
          // Store closed but has hours today - might open later or already closed
          return {
            text: `Closed · Opens at ${todayHours.open}`,
            color: 'text-red-500',
          }
        }
      }
      return {
        text: 'Closed · Check back later',
        color: 'text-red-500',
      }
    }

    // Store is open
    const now = new Date()
    const deliveryTime = new Date(now.getTime() + 15 * 60000)
    const hours = deliveryTime.getHours()
    const minutes = deliveryTime.getMinutes()
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`

    return {
      text: `15 Min Delivery · Get by ${timeStr}`,
      color: 'text-[#16a34a]',
    }
  }, [storeStatus])

  const deliveryMessage = getDeliveryMessage()
  const userFirstName = user?.name?.split(' ')[0] || null

  // Short postcode display (e.g., "SW1A" from "SW1A 1AA")
  const shortPostcode = postcode ? postcode.split(' ')[0] : null

  // Location display text
  const locationDisplay = hasLocation
    ? isWithinDeliveryZone
      ? shortPostcode
        ? `${shortPostcode} · ${distanceKm}km`
        : `${distanceKm}km away`
      : shortPostcode
        ? `${shortPostcode} · Outside zone`
        : 'Outside zone'
    : shortPostcode || null

  return (
    <>
      <header className="sticky top-0 z-50 fm-glass shadow-sm">
        {/* Top bar: Postcode + Delivery Timer + Auth + Cart */}
        <div className="bg-gray-50 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-9 text-xs">
              {/* Left: Postcode + Delivery Timer */}
              <div className="flex items-center gap-3">
                {/* Location Picker */}
                <Dialog open={postcodeDialogOpen} onOpenChange={setPostcodeDialogOpen}>
                  <DialogTrigger asChild>
                    <button className={`flex items-center gap-1 transition-colors ${
                      hasLocation && !isWithinDeliveryZone
                        ? 'text-red-500 hover:text-red-600'
                        : 'text-gray-600 hover:text-[#16a34a]'
                    }`}>
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="font-medium">
                        {locationDisplay || 'Set Location'}
                      </span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-[#16a34a]" />
                        Delivery Location
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      {/* Current location status */}
                      {hasLocation && (
                        <div className={`rounded-lg px-3 py-2 text-sm ${
                          isWithinDeliveryZone
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                          {isWithinDeliveryZone
                            ? `✓ Delivering to your area (${distanceKm}km from store)`
                            : `✗ Outside delivery zone (${distanceKm}km — max ${storeInfo?.delivery_radius_km ?? 5}km)`}
                        </div>
                      )}
                      <p className="text-sm text-gray-500">
                        Enter your postcode or use your device location to check delivery availability.
                      </p>

                      {/* Use My Location button */}
                      <Button
                        variant="outline"
                        onClick={handleUseMyLocation}
                        disabled={gpsLoading}
                        className="w-full border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white"
                      >
                        {gpsLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Detecting Location...
                          </>
                        ) : (
                          <>
                            <Navigation className="h-4 w-4 mr-2" />
                            Use My Current Location
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400">OR</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>

                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          value={postcodeInput}
                          onChange={(e) => {
                            setPostcodeInput(e.target.value)
                            setPostcodeError(null)
                          }}
                          placeholder="e.g., SW1A 1AA"
                          className="pl-9"
                          onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSave()}
                          autoFocus
                          disabled={postcodeLoading}
                        />
                      </div>
                      {postcodeError && (
                        <p className="text-xs text-red-500">{postcodeError}</p>
                      )}
                      <Button
                        onClick={handlePostcodeSave}
                        disabled={postcodeLoading}
                        className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white"
                      >
                        {postcodeLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          'Confirm Location'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Delivery Timer */}
                <div className="hidden sm:flex items-center gap-1">
                  <Clock className={`h-3.5 w-3.5 ${deliveryMessage.color}`} />
                  <span className={`font-semibold ${deliveryMessage.color}`}>
                    {deliveryMessage.text}
                  </span>
                </div>
              </div>

              {/* Right: Auth */}
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    <Link
                      href="/account"
                      className="flex items-center gap-1 text-gray-600 hover:text-[#16a34a] transition-colors"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span className="font-medium hidden sm:inline">{userFirstName || 'Account'}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={openLogin}
                      className="flex items-center gap-1 text-gray-600 hover:text-[#16a34a] transition-colors"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      <span className="font-medium hidden sm:inline">Sign In</span>
                    </button>
                    <button
                      onClick={openRegister}
                      className="bg-[#16a34a] text-white px-2.5 py-0.5 rounded text-[10px] font-semibold hover:bg-[#15803d] transition-colors"
                    >
                      Register
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main navbar: Logo + Search + Cart */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-14">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden flex-shrink-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
              <StoreLogo size={32} showName />
            </Link>

            {/* Delivery Timer (mobile) */}
            <div className="sm:hidden flex items-center gap-1">
              <Clock className={`h-3.5 w-3.5 ${deliveryMessage.color}`} />
              <span className={`text-[10px] font-semibold ${deliveryMessage.color}`}>
                {storeStatus?.isOpen ? '15 Min' : 'Closed'}
              </span>
            </div>

            {/* Search - center focus */}
            <div className="flex-1 mx-2">
              <PredictiveSearch />
            </div>

            {/* Cart Widget */}
            <Link href="/cart" className="flex-shrink-0">
              <Button
                variant="outline"
                className="h-9 px-3 border-[#16a34a] bg-[#16a34a]/5 hover:bg-[#16a34a] hover:text-white transition-colors gap-1.5 text-[#16a34a]"
              >
                <ShoppingCart className="h-4 w-4" />
                {itemCount > 0 ? (
                  <span className="text-xs font-bold">
                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                    <span className="hidden sm:inline"> | {formatPrice(totalPrice)}</span>
                  </span>
                ) : (
                  <span className="text-xs font-medium hidden sm:inline">Basket</span>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white shadow-lg">
            <div className="px-4 py-3 space-y-1">
              {/* Nav Links */}
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors"
              >
                Home
              </Link>
              <Link
                href="/catalog"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors"
              >
                Shop All
              </Link>
              {user && (
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors"
                >
                  My Account
                </Link>
              )}

              {/* Mobile delivery info */}
              <div className="px-3 py-2.5 flex items-center gap-2">
                <Clock className={`h-4 w-4 ${deliveryMessage.color}`} />
                <span className={`text-sm font-medium ${deliveryMessage.color}`}>
                  {deliveryMessage.text}
                </span>
              </div>

              <div className="border-t border-gray-100 my-2" />

              {/* Auth Section */}
              {user ? (
                <div className="space-y-1">
                  <div className="px-3 py-2 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-[#16a34a]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{userFirstName || 'User'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <Button
                    onClick={openLogin}
                    className="w-full border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white font-semibold transition-colors"
                    variant="outline"
                  >
                    <LogIn className="h-4 w-4 mr-1.5" />
                    Sign In
                  </Button>
                  <Button
                    onClick={openRegister}
                    className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Create Account
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialView={authModalView}
      />
    </>
  )
}
