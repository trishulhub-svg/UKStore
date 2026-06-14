import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { mapDriver, snakeToCamel } from '@/lib/supabase/mappers'

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
      .eq('role', 'driver')
      .maybeSingle()

    if (dbError) {
      console.error('[Admin Driver GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch driver' }, { status: 500 })
    }

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    // Use the mapper for the base driver object
    const mapped = mapDriver(driver)

    // Add drivenOrders with camelCase mapping
    const drivenOrders = ((driver as any).drivenOrders || []).map((o: any) => ({
      id: o.id,
      status: o.status,
      total: Number(o.total) || 0,
      createdAt: o.created_at,
      customer: o.customer ? { name: o.customer.full_name } : null,
    }))

    return NextResponse.json({ driver: { ...mapped, drivenOrders } })
  } catch (err) {
    console.error('[Admin Driver GET]', err)
    return NextResponse.json({ error: 'Failed to fetch driver' }, { status: 500 })
  }
}
