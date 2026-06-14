import { NextResponse } from 'next/server'
import { SUPABASE_AUTH_COOKIE_NAME, SUPABASE_REFRESH_COOKIE_NAME } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Clear the Supabase auth cookies
  const cookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0, // Expire immediately
  }

  response.cookies.set(SUPABASE_AUTH_COOKIE_NAME, '', cookieOptions)
  response.cookies.set(SUPABASE_REFRESH_COOKIE_NAME, '', { ...cookieOptions, httpOnly: true })

  // Also clear any legacy session cookies
  response.cookies.set('fresh_mart_session', '', { ...cookieOptions, httpOnly: true })

  return response
}
