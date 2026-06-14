'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, ArrowRight, AlertCircle } from 'lucide-react'

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
const STORAGE_KEY = 'delivery_postcode'

interface PostcodeGateProps {
  /** Called once the postcode is verified and accepted */
  onVerified: (postcode: string) => void
  /** The currently saved postcode (if any), so the parent can display it */
  savedPostcode?: string | null
}

export function PostcodeGate({ onVerified, savedPostcode }: PostcodeGateProps) {
  const [postcode, setPostcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSlidingOut, setIsSlidingOut] = useState(false)
  const [locallyDismissed, setLocallyDismissed] = useState(false)

  // Derive hidden state from props + local animation state
  const isHidden = (!!savedPostcode && !isSlidingOut) || locallyDismissed

  const validatePostcode = useCallback((value: string): boolean => {
    return UK_POSTCODE_REGEX.test(value.trim())
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = postcode.trim().toUpperCase()

    if (!trimmed) {
      setError('Please enter a postcode')
      return
    }

    if (!validatePostcode(trimmed)) {
      setError('Please enter a valid UK postcode (e.g., SW1A 1AA)')
      return
    }

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, trimmed)
    } catch {
      // localStorage may be unavailable; proceed anyway
    }

    // Trigger slide-out animation
    setIsSlidingOut(true)

    // After animation, hide and notify parent
    setTimeout(() => {
      setLocallyDismissed(true)
      onVerified(trimmed)
    }, 500)
  }

  const handleInputChange = (value: string) => {
    setPostcode(value)
    // Clear error when user starts typing
    if (error) setError(null)
  }

  // Already verified — render nothing
  if (isHidden) return null

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
            Fresh Mart London
          </h1>
        </div>

        {/* Headline */}
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 leading-snug">
          Fresh groceries delivered to your UK doorstep in minutes.
        </h2>
        <p className="text-sm text-gray-500 mb-8">
          Enter your postcode to check delivery availability in your area.
        </p>

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
            className="w-full h-14 bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold text-base rounded-xl shadow-md transition-all duration-200 hover:shadow-lg"
          >
            Check Availability
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </form>

        {/* Helper text */}
        <p className="mt-6 text-xs text-gray-400">
          We only deliver within the Greater London area. Your postcode helps us confirm delivery availability.
        </p>
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
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Clear the saved delivery postcode, which will re-show the gate.
 */
export function clearSavedPostcode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}
