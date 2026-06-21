'use client'

// ============================================================
// Client-side idle timeout (5 minutes of inactivity → auto logout).
//
// How it works — SLIDING WINDOW inactivity timeout:
//   1. Server-side token expires 5 minutes after issuance
//      (auth/index.ts SESSION_MAX_AGE_SECONDS).
//   2. On mount, this component starts a 5-minute countdown.
//   3. Any user activity (mousemove, mousedown, keydown, scroll, touchstart,
//      click, wheel, pointerdown) does TWO things:
//        a) Resets the client-side countdown.
//        b) (Throttled to once per minute) POSTs /api/auth/refresh which
//           issues a fresh token with a new 5-min lease.
//      So as long as the user is active, their server-side token stays alive.
//   4. When the client-side countdown reaches 0 (no activity for 5 min),
//      we redirect to /auth/login?redirect=<currentPath>&reason=idle.
//   5. We also show a "Session expiring in 30s" toast 30 seconds before
//      the timeout, so the user can interact to reset the timer.
//
// Defense in depth: even if the JS timer is somehow bypassed (laptop
// closed, tab backgrounded), the server-side 5-min token expiry means
// the next API call returns 401 and apiFetch() redirects to login.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const WARNING_MS = 30 * 1000 // warn 30s before
const CHECK_AUTH_INTERVAL_MS = 60 * 1000 // re-check auth every 60s
const REFRESH_THROTTLE_MS = 60 * 1000 // refresh token at most once per minute

// Pages where the idle timer should NOT run (public pages, auth pages).
// On these pages the user is anonymous — there's nothing to log out.
const PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback',
]

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return true
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
  'pointerdown',
]

export function IdleTimeoutHandler() {
  const pathname = usePathname()
  const [authenticated, setAuthenticated] = useState(false)
  const lastActivityRef = useRef<number>(Date.now())
  const lastRefreshRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const authCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningShownRef = useRef<boolean>(false)
  const redirectingRef = useRef<boolean>(false)

  // ── Step 1: detect auth state ──────────────────────────────
  // We ping /api/auth/session. 200 = logged in, 401 = not. We use
  // redirectOn401: false so a 401 here doesn't itself trigger a redirect
  // (we want to silently skip the idle timer for anonymous users).
  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      try {
        const res = await apiFetch('/api/auth/session', {
          redirectOn401: false,
          cache: 'no-store',
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setAuthenticated(!!data?.user)
        } else {
          setAuthenticated(false)
        }
      } catch {
        if (!cancelled) setAuthenticated(false)
      }
    }

    checkAuth()
    authCheckRef.current = setInterval(checkAuth, CHECK_AUTH_INTERVAL_MS)

    return () => {
      cancelled = true
      if (authCheckRef.current) clearInterval(authCheckRef.current)
    }
  }, [])

  // ── Step 2: reset timer on activity + refresh server token ─
  useEffect(() => {
    if (!authenticated) return
    if (isPublicPath(pathname)) return

    async function onActivity() {
      const now = Date.now()
      lastActivityRef.current = now

      // If user was warned, clear the warning flag so we can warn again
      // next time the timeout approaches.
      if (warningShownRef.current) {
        warningShownRef.current = false
      }

      // Throttled refresh — at most once per REFRESH_THROTTLE_MS.
      // This issues a new server-side token with a fresh 5-min lease.
      if (now - lastRefreshRef.current >= REFRESH_THROTTLE_MS) {
        lastRefreshRef.current = now
        try {
          await apiFetch('/api/auth/refresh', {
            method: 'POST',
            redirectOn401: false, // silent — if it fails, the next API call will redirect
          })
        } catch {
          // Non-critical — the server-side expiry will catch it.
        }
      }
    }

    ACTIVITY_EVENTS.forEach((evt) => {
      // passive: true for scroll/touch/wheel to avoid blocking; the listener
      // does minimal work (just resets a timestamp + occasionally pings refresh).
      window.addEventListener(evt, onActivity, { passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, onActivity)
      })
    }
  }, [authenticated, pathname])

  // ── Step 3: tick — check if idle too long ──────────────────
  useEffect(() => {
    if (!authenticated) return
    if (isPublicPath(pathname)) return

    // Don't run the timer on the login page itself.
    if (pathname === '/auth/login') return

    function tick() {
      if (redirectingRef.current) return

      const elapsed = Date.now() - lastActivityRef.current
      const remaining = IDLE_TIMEOUT_MS - elapsed

      // Show warning 30s before timeout (only once per idle period).
      if (remaining <= WARNING_MS && remaining > 0 && !warningShownRef.current) {
        warningShownRef.current = true
        toast.warning('Your session will expire in 30 seconds due to inactivity. Click or press a key to stay logged in.', {
          duration: WARNING_MS,
        })
      }

      // Time's up — redirect to login.
      if (remaining <= 0) {
        redirectingRef.current = true
        const currentPath = window.location.pathname + window.location.search
        const redirect = encodeURIComponent(currentPath)
        toast.info('Session expired due to inactivity. Redirecting to login...')
        // Small delay so the toast renders before navigation.
        setTimeout(() => {
          window.location.href = `/auth/login?redirect=${redirect}&reason=idle`
        }, 600)
      }
    }

    // Run every 5 seconds — granular enough for a 30s warning window.
    timerRef.current = setInterval(tick, 5 * 1000)
    tick() // initial check

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [authenticated, pathname])

  // This component renders nothing — it's purely a side-effect handler.
  return null
}

