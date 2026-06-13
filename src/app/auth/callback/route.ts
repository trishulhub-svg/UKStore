import { NextRequest, NextResponse } from 'next/server'

// This route was previously used for Supabase OAuth/PKCE code exchange.
// With local auth, OAuth callbacks are no longer handled here.
// Keeping the route to avoid 404s for any cached/bookmarked links.
export async function GET(request: NextRequest) {
  // Redirect to home page
  return NextResponse.redirect(new URL('/', request.url))
}
