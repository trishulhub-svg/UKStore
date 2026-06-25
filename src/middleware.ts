import { NextResponse, type NextRequest } from 'next/server'
import { getUserFromCookies } from '@/lib/auth/edge'
import { getRoleBasedRedirectFromRoles } from '@/lib/auth/roles'

export async function middleware(request: NextRequest) {
  let user: { uid: string; email: string; role: string; name: string; authProvider: 'local'; additionalRoles: string[] } | null = null

  try {
    user = await getUserFromCookies(request.cookies)
  } catch (error) {
    console.error('[Middleware] Session verification error:', error instanceof Error ? error.message : error)
  }

  // ─── Role-based redirect on home page ─────────────────────────
  // If an admin or driver user lands on `/`, redirect them to their dashboard.
  // Uses primary-role-based logic: a picker always goes to /picker, a driver
  // to /driver — even if they have MANAGER in additionalRoles or admin
  // feature permissions. Owner/manager go to /admin.
  if (user && request.nextUrl.pathname === '/') {
    const redirectPath = getRoleBasedRedirectFromRoles(user.role, user.additionalRoles ?? [])
    if (redirectPath !== '/') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = redirectPath
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Protect authenticated routes (customer)
  // NOTE: /checkout is intentionally NOT protected — guests can place a one-time
  // order by providing their contact details inline (guest checkout). /account
  // and /orders still require an account because they list per-user history.
  const protectedPaths = ['/account', '/orders']
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

  // ─── Block /admin root for PICKER / DRIVER primary roles ────────
  // A picker/driver with admin feature permissions can access specific
  // /admin/<feature> sub-routes (e.g. /admin/orders, /admin/products),
  // but they must NOT land on the /admin dashboard root — that's the
  // admin shell landing page, and their login already redirected them
  // to their own dashboard. If they manually type /admin into the URL
  // bar, send them back to their own dashboard instead.
  //
  // OWNER and MANAGER (primary role) can access /admin root normally.
  // A picker with MANAGER in additionalRoles is still primarily a
  // picker — they land on /picker and access admin features from there.
  if (request.nextUrl.pathname === '/admin' && user) {
    const role = (user.role || '').toUpperCase()
    if (role === 'PICKER') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/picker'
      return NextResponse.redirect(redirectUrl)
    }
    if (role === 'DRIVER') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/driver'
      return NextResponse.redirect(redirectUrl)
    }
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
