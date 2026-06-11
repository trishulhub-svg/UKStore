import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  let user = null

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Refresh the session
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser()

    user = sessionUser
  } catch (error) {
    // If Supabase is unreachable (paused project, network issue, etc.),
    // don't crash the entire site. Let the page render without auth.
    // Protected routes will still show, but the user won't be authenticated.
    console.error('[Middleware] Supabase unreachable:', error instanceof Error ? error.message : error)
  }

  // Protect authenticated routes (customer)
  const protectedPaths = ['/checkout', '/account', '/orders']
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Protect admin routes — must be authenticated
  // Role check happens inside the admin layout (needs DB access for profile)
  // Middleware only ensures user is logged in; layout verifies owner role
  if (request.nextUrl.pathname.startsWith('/admin') && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Protect admin API routes — must be authenticated
  if (request.nextUrl.pathname.startsWith('/api/admin') && !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
