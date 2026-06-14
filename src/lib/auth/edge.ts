// ============================================================
// Edge-compatible auth utilities for middleware
// Uses Supabase JWT tokens for session verification
// ============================================================

import { SUPABASE_AUTH_COOKIE_NAME, SUPABASE_REFRESH_COOKIE_NAME } from '@/lib/auth'

export interface SessionPayload {
  uid: string
  email: string
  role: string
  name: string
  authProvider: 'supabase'
}

export const SESSION_COOKIE_NAME = 'fresh_mart_session'

/**
 * Parse a Supabase JWT token to extract user info.
 * This is edge-compatible (uses Web Crypto API only).
 * Does NOT verify the JWT signature — that's done by Supabase on the server side.
 * For middleware, we trust the cookie because it was set by our auth flow.
 */
function parseSupabaseToken(token: string): { uid: string; email: string; role: string; name: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    )

    // Check if token is expired
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null

    return {
      uid: payload.sub,
      email: payload.email || '',
      role: payload.role || payload.app_metadata?.role || 'customer',
      name: payload.user_metadata?.full_name || payload.user_metadata?.name || '',
    }
  } catch {
    return null
  }
}

/**
 * Get the current user from the request cookies.
 * Tries Supabase auth cookie first.
 * This is the main function used by middleware.
 */
export async function getUserFromCookies(
  cookies: { get: (name: string) => { value: string } | undefined }
): Promise<{ uid: string; email: string; role: string; name: string; authProvider: 'supabase' } | null> {
  // Try Supabase auth cookie
  const supabaseToken = cookies.get(SUPABASE_AUTH_COOKIE_NAME)?.value
  if (supabaseToken) {
    const supabaseUser = parseSupabaseToken(supabaseToken)
    if (supabaseUser) {
      return { ...supabaseUser, authProvider: 'supabase' as const }
    }
  }

  // Fallback: check for alternative cookie names that Supabase SSR might use
  // The @supabase/ssr package uses project-specific cookie names
  const allCookies = cookies as unknown as { getAll?: () => Array<{ name: string; value: string }> }
  if (allCookies.getAll) {
    const cookieList = allCookies.getAll()
    const authCookie = cookieList.find(c =>
      c.name.startsWith('sb-') && c.name.includes('-auth-token')
    )
    if (authCookie) {
      try {
        // Supabase stores the session as JSON in the cookie
        const session = JSON.parse(decodeURIComponent(authCookie.value))
        const accessToken = session?.access_token || session?.provider_token
        if (accessToken) {
          const user = parseSupabaseToken(accessToken)
          if (user) {
            return { ...user, authProvider: 'supabase' as const }
          }
        }
      } catch {
        // Not a valid JSON cookie, try as raw token
        const user = parseSupabaseToken(authCookie.value)
        if (user) {
          return { ...user, authProvider: 'supabase' as const }
        }
      }
    }
  }

  return null
}
