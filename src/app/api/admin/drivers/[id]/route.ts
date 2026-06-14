import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/drivers/[id] — driver detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: driver, error: dbError } = await supabase
      .from('profiles')
      .select(`
        *,
        driverProfile:driver_profiles(*),
        drivenOrders:orders!driver_id(id, status, total, created_at, customer:profiles!customer_id(full_name))
      `)
      .eq('id', id)
      .eq('role', 'DRIVER')
      .maybeSingle()

    if (dbError) {
      console.error('[Admin Driver GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch driver' }, { status: 500 })
    }

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    // Map for backward compatibility
    const mapped = {
      ...driver,
      name: (driver as any).full_name,
      driverProfile: (driver as any).driverProfile?.[0] || (driver as any).driverProfile || null,
      drivenOrders: ((driver as any).drivenOrders || []).map((o: any) => ({
        ...o,
        customer: o.customer ? { name: o.customer.full_name } : null,
      })),
    }

    return NextResponse.json({ driver: mapped })
  } catch (err) {
    console.error('[Admin Driver GET]', err)
    return NextResponse.json({ error: 'Failed to fetch driver' }, { status: 500 })
  }
}
