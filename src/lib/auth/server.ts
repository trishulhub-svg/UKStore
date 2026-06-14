// ============================================================
// Server-side auth helper
// Gets the current user from Supabase session first,
// then falls back to the HMAC session cookie
// ============================================================

import { cookies } from 'next/headers'
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SUPABASE_AUTH_COOKIE_NAME,
  getAuthStrategy,
  type SessionPayload,
} from '@/lib/auth'

export interface ServerUser {
  id: string
  email: string
  name: string
  role: string
  authProvider: 'local' | 'supabase'
}

/**
 * Get the current authenticated user.
 *
 * Strategy:
 * 1. If Supabase is configured, try to get user from Supabase session cookie
 * 2. Fall back to local HMAC session cookie
 *
 * This ensures seamless operation whether Supabase is connected or not.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const strategy = getAuthStrategy()
    const cookieStore = await cookies()

    // ─── Try Supabase Auth first (when configured) ─────────
    if (strategy === 'supabase') {
      const supabaseToken = cookieStore.get(SUPABASE_AUTH_COOKIE_NAME)?.value

      if (supabaseToken) {
        try {
          // Verify the Supabase JWT token
          const parts = supabaseToken.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(
              Buffer.from(parts[1], 'base64url').toString('utf-8')
            )

            // Check if token is expired
            if (payload.exp && payload.exp * 1000 > Date.now()) {
              // Get user role from app metadata or default to customer
              const role = payload.role || payload.app_metadata?.role || 'customer'

              return {
                id: payload.sub,
                email: payload.email || '',
                name: payload.user_metadata?.full_name || payload.user_metadata?.name || '',
                role,
                authProvider: 'supabase',
              }
            }
          }
        } catch {
          // Supabase token parsing failed, fall through to local auth
        }
      }
    }

    // ─── Fall back to local HMAC session ────────────────────
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!token) return null

    const payload: SessionPayload | null = verifySessionToken(token)
    if (!payload) return null

    return {
      id: payload.uid,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      authProvider: payload.authProvider || 'local',
    }
  } catch {
    return null
  }
}
