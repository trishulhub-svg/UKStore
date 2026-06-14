import { NextResponse, type NextRequest } from 'next/server'
import { getUserFromCookies } from '@/lib/auth/edge'
import { getRoleBasedRedirect } from '@/lib/auth/roles'

export async function middleware(request: NextRequest) {
  let user: { uid: string; email: string; role: string; name: string; authProvider: 'local' } | null = null

  try {
    user = await getUserFromCookies(request.cookies)
  } catch (error) {
    console.error('[Middleware] Session verification error:', error instanceof Error ? error.message : error)
  }

  // ─── Role-based redirect on home page ─────────────────────────
  // If an admin or driver user lands on `/`, redirect them to their dashboard
  if (user && request.nextUrl.pathname === '/') {
    const redirectPath = getRoleBasedRedirect(user.role)
    if (redirectPath !== '/') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = redirectPath
      return NextResponse.redirect(redirectUrl)
    }
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
  if (request.nextUrl.pathname.startsWith('/admin') && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Protect picker routes — must be authenticated
  if (request.nextUrl.pathname.startsWith('/picker') && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Protect driver routes — must be authenticated
  if (request.nextUrl.pathname.startsWith('/driver') && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Protect admin API routes — must be authenticated
  if (request.nextUrl.pathname.startsWith('/api/admin') && !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Protect picker API routes — must be authenticated
  if (request.nextUrl.pathname.startsWith('/api/picker') && !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
