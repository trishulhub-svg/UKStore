// ============================================================
// Server-side auth helper — Supabase Auth Only
// Gets the current user from Supabase JWT session cookies
// ============================================================

import { cookies } from 'next/headers'
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/auth'

export interface ServerUser {
  id: string
  email: string
  name: string
  role: string
}

/**
 * Get the current authenticated user from Supabase session cookies.
 * Parses the JWT access token to extract user info.
 * Role is fetched from the profile table if needed.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies()
    const supabaseToken = cookieStore.get(SUPABASE_AUTH_COOKIE_NAME)?.value

    if (!supabaseToken) return null

    // Parse the Supabase JWT token
    const parts = supabaseToken.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    )

    // Check if token is expired
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null

    // Extract user info from JWT
    const userId = payload.sub
    const email = payload.email || ''
    const name = payload.user_metadata?.full_name || payload.user_metadata?.name || ''
    const role = payload.app_metadata?.role || 'customer'

    if (!userId) return null

    return { id: userId, email, name, role }
  } catch {
    return null
  }
}
