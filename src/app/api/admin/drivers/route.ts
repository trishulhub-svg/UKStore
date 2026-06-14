import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/drivers — list drivers
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    // Build query for driver profiles with their profile data
    let query = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        is_active,
        created_at,
        driverProfile:driver_profiles(*),
        drivenOrders:orders!driver_id(id, status)
      `)
      .eq('role', 'DRIVER')

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    query = query.order('created_at', { ascending: false })

    const { data: drivers, error: dbError } = await query

    if (dbError) {
      console.error('[Admin Drivers GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 })
    }

    // Map for backward compatibility
    const mapped = (drivers || []).map((d: any) => ({
      ...d,
      name: d.full_name,
      driverProfile: d.driverProfile?.[0] || d.driverProfile || null,
      _count: { drivenOrders: d.drivenOrders?.length || 0 },
    }))

    return NextResponse.json({ drivers: mapped })
  } catch (err) {
    console.error('[Admin Drivers GET]', err)
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 })
  }
}

// PATCH /api/admin/drivers — approve/reject/toggle driver
export async function PATCH(request: NextRequest) {
  const { error, user: adminUser } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    const { driverId, verificationStatus, rejectionReason, isActive } = body

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required' }, { status: 400 })
    }

    // Check existence
    const { data: driver, error: fetchError } = await supabase
      .from('profiles')
      .select('id, driverProfile:driver_profiles(*)')
      .eq('id', driverId)
      .eq('role', 'DRIVER')
      .maybeSingle()

    if (fetchError) {
      console.error('[Admin Drivers PATCH] fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to update driver' }, { status: 500 })
    }
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    const driverProfile = (driver as any).driverProfile?.[0] || (driver as any).driverProfile || null

    // Update driver profile verification
    if (verificationStatus && driverProfile) {
      const { error: profileUpdateError } = await supabase
        .from('driver_profiles')
        .update({
          verification_status: verificationStatus,
          verified_by: adminUser!.id,
          verified_at: new Date().toISOString(),
          rejection_reason: verificationStatus === 'rejected' ? (rejectionReason || null) : null,
        })
        .eq('user_id', driverId)

      if (profileUpdateError) {
        console.error('[Admin Drivers PATCH] profile update error:', profileUpdateError)
        return NextResponse.json({ error: 'Failed to update driver verification' }, { status: 500 })
      }
    }

    // Toggle active
    if (isActive !== undefined) {
      const { error: activeUpdateError } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', driverId)

      if (activeUpdateError) {
        console.error('[Admin Drivers PATCH] active update error:', activeUpdateError)
        return NextResponse.json({ error: 'Failed to update driver status' }, { status: 500 })
      }
    }

    // Fetch updated driver
    const { data: updated, error: refetchError } = await supabase
      .from('profiles')
      .select(`
        id, full_name, email, phone, is_active,
        driverProfile:driver_profiles(*),
        drivenOrders:orders!driver_id(id)
      `)
      .eq('id', driverId)
      .maybeSingle()

    if (refetchError) {
      console.error('[Admin Drivers PATCH] refetch error:', refetchError)
      return NextResponse.json({ error: 'Failed to update driver' }, { status: 500 })
    }

    const mapped = {
      ...updated,
      name: (updated as any)?.full_name,
      driverProfile: (updated as any)?.driverProfile?.[0] || (updated as any)?.driverProfile || null,
      _count: { drivenOrders: (updated as any)?.drivenOrders?.length || 0 },
    }

    return NextResponse.json({ driver: mapped })
  } catch (err) {
    console.error('[Admin Drivers PATCH]', err)
    return NextResponse.json({ error: 'Failed to update driver' }, { status: 500 })
  }
}
