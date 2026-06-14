import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/promotions/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: promotion, error: dbError } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (dbError) {
      console.error('[Admin Promotion GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch promotion' }, { status: 500 })
    }

    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    return NextResponse.json({ promotion })
  } catch (err) {
    console.error('[Admin Promotion GET]', err)
    return NextResponse.json({ error: 'Failed to fetch promotion' }, { status: 500 })
  }
}

// PATCH /api/admin/promotions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params
    const body = await request.json()

    // Check existence
    const { data: existing, error: fetchError } = await supabase
      .from('promotions')
      .select('id')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Promotion PATCH] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.description !== undefined) data.description = body.description || null
    if (body.discountType !== undefined) data.discount_type = body.discountType
    if (body.discountValue !== undefined) data.discount_value = parseFloat(body.discountValue)
    if (body.startDate !== undefined) data.start_date = body.startDate
    if (body.endDate !== undefined) data.end_date = body.endDate
    if (body.appliesToCategoryIds !== undefined) data.applies_to_category_ids = body.appliesToCategoryIds || null
    if (body.excludesHfss !== undefined) data.excludes_hfss = body.excludesHfss
    if (body.isActive !== undefined) data.is_active = body.isActive
    if (body.code !== undefined) data.code = body.code || null

    const { data: promotion, error: dbError } = await supabase
      .from('promotions')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (dbError) {
      console.error('[Admin Promotion PATCH]', dbError)
      return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 })
    }

    return NextResponse.json({ promotion })
  } catch (err) {
    console.error('[Admin Promotion PATCH]', err)
    return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 })
  }
}

// DELETE /api/admin/promotions/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    // Check existence
    const { data: existing, error: fetchError } = await supabase
      .from('promotions')
      .select('id')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Promotion DELETE] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to delete promotion' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('promotions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Admin Promotion DELETE]', deleteError)
      return NextResponse.json({ error: 'Failed to delete promotion' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Promotion DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete promotion' }, { status: 500 })
  }
}
