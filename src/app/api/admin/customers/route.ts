import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/customers — list customers
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build query for customer profiles with their orders
    let query = supabase
      .from('profiles')
      .select('id, full_name, email, phone, is_active, created_at, orders:orders(id, total, status, created_at)', { count: 'exact' })
      .eq('role', 'CUSTOMER')

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, (page - 1) * limit + limit - 1)

    const { data: customers, error: dbError, count } = await query

    if (dbError) {
      console.error('[Admin Customers GET]', dbError)
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }

    // Compute aggregated stats for each customer
    const enriched = (customers || []).map((c: any) => {
      const orders = c.orders || []
      const orderCount = orders.length
      const totalSpent = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
      return {
        ...c,
        name: c.full_name, // backward compatibility
        orderCount,
        totalSpent,
      }
    })

    return NextResponse.json({ customers: enriched, total: count, page, limit })
  } catch (err) {
    console.error('[Admin Customers GET]', err)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}
