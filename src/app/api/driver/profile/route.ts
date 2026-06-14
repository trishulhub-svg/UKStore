import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

// GET /api/driver/profile — driver profile
export async function GET() {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (user.role.toLowerCase() !== 'driver') {
    return NextResponse.json({ error: 'Forbidden — driver role required' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data: profile, error } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Auto-create profile if it doesn't exist
    let result = profile
    if (!profile) {
      if (error && error.code !== 'PGRST116') {
        console.error('[Driver Profile GET] fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
      }

      const { data: created, error: createError } = await supabase
        .from('driver_profiles')
        .insert({ user_id: user.id })
        .select()
        .single()

      if (createError || !created) {
        console.error('[Driver Profile GET] create error:', createError)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }
      result = created
    }

    return NextResponse.json({
      profile: result,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: null,
      },
    })
  } catch (err) {
    console.error('[Driver Profile GET]', err)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

// PATCH /api/driver/profile — update vehicle info, upload documents
export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (user.role.toLowerCase() !== 'driver') {
    return NextResponse.json({ error: 'Forbidden — driver role required' }, { status: 403 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { vehicleType, vehicleReg, nationalInsuranceNumber, rightToWorkUrl, drivingLicenseUrl } = body

    const data: Record<string, unknown> = {}
    if (vehicleType !== undefined) data.vehicle_type = vehicleType
    if (vehicleReg !== undefined) data.vehicle_reg = vehicleReg
    if (nationalInsuranceNumber !== undefined) data.national_insurance_number = nationalInsuranceNumber
    if (rightToWorkUrl !== undefined) data.right_to_work_url = rightToWorkUrl
    if (drivingLicenseUrl !== undefined) data.driving_license_url = drivingLicenseUrl

    // If documents are being uploaded, reset verification to pending
    if (rightToWorkUrl || drivingLicenseUrl) {
      data.verification_status = 'pending'
      data.rejection_reason = null
    }

    // Check if profile exists
    const { data: existing, error: fetchError } = await supabase
      .from('driver_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[Driver Profile PATCH] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    let profile

    if (existing) {
      // Update existing profile
      const { data: updated, error: updateError } = await supabase
        .from('driver_profiles')
        .update(data)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError || !updated) {
        console.error('[Driver Profile PATCH] update error:', updateError)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
      }
      profile = updated
    } else {
      // Create new profile
      const { data: created, error: createError } = await supabase
        .from('driver_profiles')
        .insert({ user_id: user.id, ...data })
        .select()
        .single()

      if (createError || !created) {
        console.error('[Driver Profile PATCH] create error:', createError)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }
      profile = created
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[Driver Profile PATCH]', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
