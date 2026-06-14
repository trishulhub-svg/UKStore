import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

// GET /api/user/addresses — list addresses
export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[User Addresses GET]', error)
      return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 })
    }

    return NextResponse.json({ addresses })
  } catch (err) {
    console.error('[User Addresses GET]', err)
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 })
  }
}

// POST /api/user/addresses — add address
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { label, addressLine1, addressLine2, city, postcode, latitude, longitude, isDefault } = body

    if (!addressLine1 || !city || !postcode) {
      return NextResponse.json(
        { error: 'Address line 1, city, and postcode are required' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      const { error: updateError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)

      if (updateError) {
        console.error('[User Addresses POST] unset defaults error', updateError)
      }
    }

    const { data: address, error } = await supabase
      .from('addresses')
      .insert({
        user_id: user.id,
        label: label || null,
        address_line_1: addressLine1,
        address_line_2: addressLine2 || null,
        city,
        postcode,
        latitude: latitude || null,
        longitude: longitude || null,
        is_default: isDefault || false,
      })
      .select()
      .single()

    if (error) {
      console.error('[User Addresses POST]', error)
      return NextResponse.json({ error: 'Failed to add address' }, { status: 500 })
    }

    return NextResponse.json({ address }, { status: 201 })
  } catch (err) {
    console.error('[User Addresses POST]', err)
    return NextResponse.json({ error: 'Failed to add address' }, { status: 500 })
  }
}

// PATCH /api/user/addresses — update address (bulk)
export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { addressId, label, addressLine1, addressLine2, city, postcode, latitude, longitude, isDefault } = body

    if (!addressId) {
      return NextResponse.json({ error: 'addressId is required' }, { status: 400 })
    }

    const { data: existing, error: findError } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', addressId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      const { error: updateError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)

      if (updateError) {
        console.error('[User Addresses PATCH] unset defaults error', updateError)
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
      .eq('id', addressId)
      .select()
      .single()

    if (error) {
      console.error('[User Addresses PATCH]', error)
      return NextResponse.json({ error: 'Failed to update address' }, { status: 500 })
    }

    return NextResponse.json({ address })
  } catch (err) {
    console.error('[User Addresses PATCH]', err)
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 })
  }
}

// DELETE /api/user/addresses — delete address
export async function DELETE(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const addressId = searchParams.get('addressId')

    if (!addressId) {
      return NextResponse.json({ error: 'addressId is required' }, { status: 400 })
    }

    const { data: existing, error: findError } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', addressId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (findError || !existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', addressId)

    if (error) {
      console.error('[User Addresses DELETE]', error)
      return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[User Addresses DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 })
  }
}
