import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/delivery-zones/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: zone, error: dbError } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (dbError) {
      console.error('[Admin Delivery Zone GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch delivery zone' }, { status: 500 })
    }

    if (!zone) {
      return NextResponse.json({ error: 'Delivery zone not found' }, { status: 404 })
    }

    return NextResponse.json({ zone })
  } catch (err) {
    console.error('[Admin Delivery Zone GET]', err)
    return NextResponse.json({ error: 'Failed to fetch delivery zone' }, { status: 500 })
  }
}

// PATCH /api/admin/delivery-zones/[id]
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
      .from('delivery_zones')
      .select('id')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Delivery Zone PATCH] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to update delivery zone' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Delivery zone not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.postcodes !== undefined) data.postcodes = body.postcodes
    if (body.deliveryFee !== undefined) data.delivery_fee = parseFloat(body.deliveryFee)
    if (body.minimumOrder !== undefined) data.minimum_order = parseFloat(body.minimumOrder)
    if (body.isActive !== undefined) data.is_active = body.isActive

    const { data: zone, error: dbError } = await supabase
      .from('delivery_zones')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (dbError) {
      console.error('[Admin Delivery Zone PATCH]', dbError)
      return NextResponse.json({ error: 'Failed to update delivery zone' }, { status: 500 })
    }

    return NextResponse.json({ zone })
  } catch (err) {
    console.error('[Admin Delivery Zone PATCH]', err)
    return NextResponse.json({ error: 'Failed to update delivery zone' }, { status: 500 })
  }
}

// DELETE /api/admin/delivery-zones/[id]
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
      .from('delivery_zones')
      .select('id')
      .eq('id', id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Delivery Zone DELETE] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to delete delivery zone' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Delivery zone not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Admin Delivery Zone DELETE]', deleteError)
      return NextResponse.json({ error: 'Failed to delete delivery zone' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Admin Delivery Zone DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete delivery zone' }, { status: 500 })
  }
}
