// ============================================================
// Client-side Auth Helper
// Replaces Supabase client for authentication
// Uses fetch() to call local API routes
// ============================================================

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: string
  createdAt?: string
}

export interface AuthResponse {
  user: AuthUser | null
  error: string | null
}

/**
 * Register a new account
 */
export async function authRegister(email: string, password: string, fullName: string): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { user: null, error: data.error || 'Registration failed.' }
    }

    return { user: data.user, error: null }
  } catch {
    return { user: null, error: 'Unable to connect to the server. Please check your internet connection and try again.' }
  }
}

/**
 * Log in with email and password
 */
export async function authLogin(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { user: null, error: data.error || 'Login failed.' }
    }

    return { user: data.user, error: null }
  } catch {
    return { user: null, error: 'Unable to connect to the server. Please check your internet connection and try again.' }
  }
}

/**
 * Log out
 */
export async function authLogout(): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
    })

    if (!res.ok) {
      return { error: 'Logout failed.' }
    }

    return { error: null }
  } catch {
    return { error: 'Unable to connect to the server.' }
  }
}

/**
 * Get the current session user
 */
export async function authGetSession(): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/session')

    if (!res.ok) {
      return { user: null, error: null }
    }

    const data = await res.json()
    return { user: data.user, error: null }
  } catch {
    return { user: null, error: null }
  }
}
