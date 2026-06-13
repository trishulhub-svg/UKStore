// ============================================================
// Server-side auth helper
// Gets the current user from the session cookie in server components
// ============================================================

import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE_NAME, type SessionPayload } from '@/lib/auth'

export interface ServerUser {
  id: string
  email: string
  name: string
  role: string
}

/**
 * Get the current authenticated user from the session cookie.
 * Use this in Server Components and Route Handlers instead of Supabase auth.
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
    }
  } catch {
    return null
  }
}
