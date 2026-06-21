// ============================================================
// Global auth-user-updated event
//
// Why this exists:
//   After the store owner changes their email via /account/profile,
//   the server issues a fresh session cookie carrying the new email.
//   But several client components (Navbar, DriverLayout, PickerLayout,
//   HomeClient) cache the user object in useState after a single
//   authGetSession() call in useEffect. Because their useEffect only
//   runs on mount, the cached user.email stays STALE until a full
//   page reload — so the Navbar keeps showing the OLD email even
//   though the cookie has already been updated.
//
//   This module provides a tiny pub/sub on top of window.dispatchEvent
//   so any component that changes the user's session (email change,
//   name change, role escalation, etc.) can broadcast "the user has
//   changed — please re-fetch your session".
//
// Usage:
//   // In the component that changes the user:
//   import { dispatchAuthUserUpdated } from '@/lib/auth-events'
//   dispatchAuthUserUpdated()
//
//   // In the component that caches the user:
//   import { onAuthUserUpdated } from '@/lib/auth-events'
//   useEffect(() => {
//     const unsub = onAuthUserUpdated(() => authGetSession().then(({ user }) => setUser(user)))
//     return unsub
//   }, [])
// ============================================================

export const AUTH_USER_UPDATED_EVENT = 'freshmart:auth-user-updated'

/**
 * Fire the auth-user-updated event on the window.
 * Any component that has subscribed via onAuthUserUpdated() will re-run
 * its callback (typically a re-fetch of /api/auth/session).
 *
 * Safe to call during SSR — it no-ops when window is undefined.
 */
export function dispatchAuthUserUpdated(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_USER_UPDATED_EVENT))
}

/**
 * Subscribe to the auth-user-updated event.
 *
 * @param callback The function to run when the user's session changes
 *                 (e.g., email updated, role changed).
 * @returns An unsubscribe function — call it in your useEffect cleanup
 *          to avoid memory leaks.
 */
export function onAuthUserUpdated(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = () => callback()
  window.addEventListener(AUTH_USER_UPDATED_EVENT, handler)

  return () => {
    window.removeEventListener(AUTH_USER_UPDATED_EVENT, handler)
  }
}
