'use client'

import { Store } from 'lucide-react'
import { useStoreInfo } from '@/lib/store-info'

interface StoreLogoProps {
  size?: number
  className?: string
  /** Show the store name next to the logo */
  showName?: boolean
  /** Suffix to append to the name (e.g., " Admin") */
  nameSuffix?: string
  /** Force a particular style for the fallback icon container */
  fallbackClassName?: string
}

/**
 * StoreLogo — renders the store's custom uploaded logo if present,
 * otherwise falls back to a green Store icon.
 *
 * Used in: customer navbar, footer, admin sidebar (desktop + mobile),
 * picker/driver shells, and anywhere the store brand is shown.
 */
export function StoreLogo({
  size = 24,
  className = '',
  showName = false,
  nameSuffix = '',
  fallbackClassName = '',
}: StoreLogoProps) {
  const { store } = useStoreInfo()
  const logoUrl = store?.logoUrl
  const storeName = store?.name || 'Fresh Mart'

  if (logoUrl) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <img
          src={logoUrl}
          alt={`${storeName} logo`}
          width={size}
          height={size}
          className="rounded-md object-contain"
          style={{ width: size, height: size }}
        />
        {showName && (
          <span className="font-bold text-lg text-gray-900">{storeName}{nameSuffix}</span>
        )}
      </span>
    )
  }

  // Fallback to the green Store icon (no Z.ai branding)
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-green-600 text-white ${fallbackClassName}`}
        style={{ width: size, height: size }}
      >
        <Store style={{ width: size * 0.65, height: size * 0.65 }} />
      </span>
      {showName && (
        <span className="font-bold text-lg text-gray-900">{storeName}{nameSuffix}</span>
      )}
    </span>
  )
}
