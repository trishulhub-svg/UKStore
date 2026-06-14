import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

// PATCH /api/user/notifications/[id] — mark as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params
    const body = await request.json()
    const { isRead, markAllRead } = body

    if (markAllRead) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) {
        console.error('[User Notification PATCH] mark all read error', error)
        return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    const { data: existing, error: findError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: isRead !== undefined ? isRead : true })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[User Notification PATCH]', error)
      return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
    }

    return NextResponse.json({ notification })
  } catch (err) {
    console.error('[User Notification PATCH]', err)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}
