// ============================================================
// Client-side fetch wrapper with global 401 handling.
//
// Replaces raw `fetch()` calls in client components. On 401 (expired
// session), redirects to /auth/login?redirect=<currentPath> instead
// of leaving the user on a broken page with "Failed to load X" toasts.
//
// Usage:
//   import { apiFetch } from '@/lib/api-fetch'
//
//   const res = await apiFetch('/api/admin/products')
//   if (!res.ok) throw new Error()
//   const data = await res.json()
//
// On 401, this throws and the redirect happens automatically — the
// caller's catch block runs but the user is already being redirected.
// ============================================================

const LOGIN_PATH = '/auth/login'

function redirectToLogin() {
  if (typeof window === 'undefined') return
  const currentPath = window.location.pathname + window.location.search
  const redirect = encodeURIComponent(currentPath)
  // Avoid redirect loops
  if (window.location.pathname === LOGIN_PATH) return
  window.location.href = `${LOGIN_PATH}?redirect=${redirect}`
}

export interface ApiFetchInit extends RequestInit {
  /**
   * If true (default), a 401 response triggers a redirect to /auth/login.
   * Set to false for endpoints where 401 is expected/handled differently
   * (e.g., checking if a session exists).
   */
  redirectOn401?: boolean
}

/**
 * Fetch wrapper that auto-redirects to login on 401.
 *
 * Behavior:
 *   - 401 → redirect to /auth/login?redirect=<currentPath>, then throw
 *     (the throw prevents the caller from trying to parse a JSON error
 *     body that may not exist).
 *   - All other statuses → return the Response unchanged. The caller is
 *     responsible for checking res.ok and parsing the body.
 *   - Network errors → throw (caller's catch block runs).
 */
export async function apiFetch(
  url: string,
  init: ApiFetchInit = {}
): Promise<Response> {
  const { redirectOn401 = true, ...fetchInit } = init

  let res: Response
  try {
    res = await fetch(url, fetchInit)
  } catch (err) {
    // Network error / CORS / DNS failure
    throw err
  }

  if (res.status === 401 && redirectOn401) {
    redirectToLogin()
    // Throw to prevent caller from trying to parse a possibly-empty body
    throw new Error('Session expired — redirecting to login')
  }

  return res
}

/**
 * Convenience wrapper: fetch + parse JSON + throw on non-OK.
 *
 * Returns the parsed JSON body. Throws on 401 (auto-redirect) or any
 * other non-OK status.
 *
 *   const data = await apiFetchJson<{ products: Product[] }>('/api/admin/products')
 */
export async function apiFetchJson<T = any>(
  url: string,
  init: ApiFetchInit = {}
): Promise<T> {
  const res = await apiFetch(url, init)
  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) errorMsg = body.error
    } catch {
      // Body wasn't JSON — keep the default message
    }
    throw new Error(errorMsg)
  }
  return res.json() as Promise<T>
}
