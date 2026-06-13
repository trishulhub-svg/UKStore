import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionTokenEdge, SESSION_COOKIE_NAME } from '@/lib/auth/edge'

export async function middleware(request: NextRequest) {
  let user: { uid: string; email: string; role: string; name: string } | null = null

  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (token) {
      user = await verifySessionTokenEdge(token)
    }
  } catch (error) {
    console.error('[Middleware] Session verification error:', error instanceof Error ? error.message : error)
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

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
