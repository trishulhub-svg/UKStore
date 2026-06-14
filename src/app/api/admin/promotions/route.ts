import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// GET /api/admin/promotions
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()

    const { data: promotions, error: dbError } = await supabase
      .from('promotions')
      .select('*')
      .eq('store_id', STORE_ID)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('[Admin Promotions GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch promotions' }, { status: 500 })
    }

    return NextResponse.json({ promotions })
  } catch (err) {
    console.error('[Admin Promotions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch promotions' }, { status: 500 })
  }
}

// POST /api/admin/promotions
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()

    const { data: promotion, error: dbError } = await supabase
      .from('promotions')
      .insert({
        store_id: STORE_ID,
        name: body.name,
        description: body.description || null,
        discount_type: body.discountType,
        discount_value: parseFloat(body.discountValue),
        start_date: body.startDate,
        end_date: body.endDate,
        applies_to_category_ids: body.appliesToCategoryIds || null,
        excludes_hfss: body.excludesHfss || false,
        is_active: body.isActive !== false,
        code: body.code || null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[Admin Promotions POST]', dbError)
      return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 })
    }

    return NextResponse.json({ promotion }, { status: 201 })
  } catch (err) {
    console.error('[Admin Promotions POST]', err)
    return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 })
  }
}
