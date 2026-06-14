import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

// PATCH /api/user/addresses/[id] — update single address
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

    const { data: existing, error: findError } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const { label, addressLine1, addressLine2, city, postcode, latitude, longitude, isDefault } = body

    // If setting as default, unset other defaults
    if (isDefault) {
      const { error: updateError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)

      if (updateError) {
        console.error('[User Address PATCH] unset defaults error', updateError)
      }
    }

    const data: Record<string, unknown> = {}
    if (label !== undefined) data.label = label
    if (addressLine1 !== undefined) data.address_line_1 = addressLine1
    if (addressLine2 !== undefined) data.address_line_2 = addressLine2
    if (city !== undefined) data.city = city
    if (postcode !== undefined) data.postcode = postcode
    if (latitude !== undefined) data.latitude = latitude
    if (longitude !== undefined) data.longitude = longitude
    if (isDefault !== undefined) data.is_default = isDefault

    const { data: address, error } = await supabase
      .from('addresses')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[User Address PATCH]', error)
      return NextResponse.json({ error: 'Failed to update address' }, { status: 500 })
    }

    return NextResponse.json({ address })
  } catch (err) {
    console.error('[User Address PATCH]', err)
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 })
  }
}

// DELETE /api/user/addresses/[id] — delete address
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: existing, error: findError } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[User Address DELETE]', error)
      return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[User Address DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 })
  }
}
