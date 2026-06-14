import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

// GET /api/user/notifications — list notifications
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Build main query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    if (filter === 'unread') {
      query = query.eq('is_read', false)
    } else if (filter === 'orders') {
      query = query.eq('type', 'order_update')
    } else if (filter === 'promotions') {
      query = query.eq('type', 'promotion')
    }

    const { data: notifications, count: total, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('[User Notifications GET]', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Get unread count
    const { count: unreadCount, error: unreadError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (unreadError) {
      console.error('[User Notifications GET] unread count error', unreadError)
    }

    return NextResponse.json({ notifications, total: total ?? 0, unreadCount: unreadCount ?? 0, page, limit })
  } catch (err) {
    console.error('[User Notifications GET]', err)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}
