'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for PWA support.
 * Must be used inside a client component tree.
 *
 * Also handles SW updates:
 * - When a new SW version is detected, it auto-activates (skipWaiting)
 * - Listens for the SW_UPDATED message from the new SW and refreshes the page
 *   so the user picks up the new caches immediately
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered with scope:', registration.scope)

          // Listen for new SW versions
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (!newWorker) return
            console.log('[SW] New version installing...')
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New SW installed — tell it to skip waiting so it activates immediately
                console.log('[SW] New version installed, activating...')
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          })
        })
        .catch((error) => {
          console.warn('[SW] Registration failed:', error)
        })
    }

    // Listen for messages from the SW
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[SW] Got SW_UPDATED message, refreshing page...')
        // Force a hard reload to pick up the new SW + new caches
        window.location.reload()
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)

    // Check if there's a new SW waiting to activate
    if (navigator.serviceWorker.controller) {
      // Already have a SW — check for updates
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.update().catch(() => {})
        }
      })
    }

    window.addEventListener('load', registerSW)

    return () => {
      window.removeEventListener('load', registerSW)
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])

  return null
}
