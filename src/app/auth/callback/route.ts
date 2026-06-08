import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/'

  if (code) {
    // Build the redirect response first
    const response = NextResponse.redirect(new URL(next, request.url))

    // Create Supabase client that writes cookies to the response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Exchange the code for a session — this triggers setAll above
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return response
    }

    console.error('Auth callback error:', error.message)
  }

  // Return to login on error
  return NextResponse.redirect(new URL('/auth/login', request.url))
}
