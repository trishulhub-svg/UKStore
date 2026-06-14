'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for PWA support.
 * Must be used inside a client component tree.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered with scope:', registration.scope)
        })
        .catch((error) => {
          console.warn('[SW] Registration failed:', error)
        })
    })
  }, [])

  return null
}
