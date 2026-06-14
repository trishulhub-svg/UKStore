import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/delivery-zones
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()

    const { data: zones, error: dbError } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('store_id', STORE_ID)
      .order('name', { ascending: true })

    if (dbError) {
      console.error('[Admin Delivery Zones GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 })
    }

    return NextResponse.json({ zones })
  } catch (err) {
    console.error('[Admin Delivery Zones GET]', err)
    return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 })
  }
}

// POST /api/admin/delivery-zones
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()

    const { data: zone, error: dbError } = await supabase
      .from('delivery_zones')
      .insert({
        store_id: STORE_ID,
        name: body.name,
        postcodes: body.postcodes, // JSONB
        delivery_fee: parseFloat(body.deliveryFee || '0'),
        minimum_order: parseFloat(body.minimumOrder || '0'),
        is_active: body.isActive !== false,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[Admin Delivery Zones POST]', dbError)
      return NextResponse.json({ error: 'Failed to create delivery zone' }, { status: 500 })
    }

    return NextResponse.json({ zone }, { status: 201 })
  } catch (err) {
    console.error('[Admin Delivery Zones POST]', err)
    return NextResponse.json({ error: 'Failed to create delivery zone' }, { status: 500 })
  }
}
