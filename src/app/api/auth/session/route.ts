import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/auth'

/**
 * GET /api/auth/session
 * Returns the current user from the Supabase JWT token in cookies.
 * Verifies the token with Supabase to ensure it's still valid.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SUPABASE_AUTH_COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Verify the token with Supabase Auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ user: null }, { status: 503 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Fetch profile for role info
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: profile?.full_name || user.user_metadata?.full_name || '',
        role: profile?.role || 'customer',
      },
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
