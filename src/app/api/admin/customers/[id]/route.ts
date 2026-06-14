import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { snakeToCamel } from '@/lib/supabase/mappers'

// GET /api/admin/customers/[id] — customer detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { id } = await params

    const { data: customer, error: dbError } = await supabase
      .from('profiles')
      .select(`
        *,
        addresses:addresses(*),
        orders:orders(*, items:order_items(product_name, quantity, unit_price))
      `)
      .eq('id', id)
      .eq('role', 'customer')
      .maybeSingle()

    if (dbError) {
      console.error('[Admin Customer GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
    }

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Convert entire row to camelCase
    const mapped = snakeToCamel(customer)

    // Add computed fields
    const totalSpent = (customer.orders || []).reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)
    mapped.name = customer.full_name
    mapped.totalSpent = totalSpent

    return NextResponse.json({ customer: mapped })
  } catch (err) {
    console.error('[Admin Customer GET]', err)
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 })
  }
}
