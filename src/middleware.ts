import { NextResponse, type NextRequest } from 'next/server'
import { getUserFromCookies } from '@/lib/auth/edge'

export async function middleware(request: NextRequest) {
  let user: { uid: string; email: string; role: string; name: string; authProvider: 'supabase' } | null = null

  try {
    user = await getUserFromCookies(request.cookies)
  } catch (error) {
    console.error('[Middleware] Session verification error:', error instanceof Error ? error.message : error)
  }

  // Protect authenticated routes (customer)
  const protectedPaths = ['/checkout', '/account', '/orders', '/favourites', '/addresses', '/notifications']
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Protect admin routes — must be authenticated + owner/manager role
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/auth/login'
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Role check — only owner and manager can access admin
    // Case-insensitive comparison to handle both uppercase (Prisma enum) and lowercase (legacy)
    if (!['owner', 'manager'].includes(user.role.toLowerCase())) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Protect driver routes — must be authenticated + driver role
  if (request.nextUrl.pathname.startsWith('/driver')) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/auth/login'
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Role check — only driver can access driver app
    if (user.role.toLowerCase() !== 'driver') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Protect admin API routes — must be authenticated
  if (request.nextUrl.pathname.startsWith('/api/admin') && !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Protect driver API routes — must be authenticated
  if (request.nextUrl.pathname.startsWith('/api/driver') && !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
