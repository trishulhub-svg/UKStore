// ============================================================
// Server-side auth helper
// Single auth source: HMAC-signed session token
// No more dual Supabase/local auth — eliminates the
// "Supabase JWT overrides local token role" bug permanently.
// ============================================================

import { cookies } from 'next/headers'
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from '@/lib/auth'

export interface ServerUser {
  id: string
  email: string
  name: string
  role: string
  authProvider: 'local'
}

/**
 * Get the current authenticated user from the session cookie.
 * Single source of truth: the HMAC-signed session token.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies()

    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!token) return null

    const payload: SessionPayload | null = verifySessionToken(token)
    if (!payload) return null

    return {
      id: payload.uid,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      authProvider: 'local',
    }
  } catch {
    return null
  }
}
