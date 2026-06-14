import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// POST /api/user/orders/[id]/reorder — reorder (returns items to add to cart)
export async function POST(
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

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(id, name, price, image_url, slug, is_available, stock_quantity, vat_rate, unit, category:categories(name, slug)))')
      .eq('id', id)
      .eq('customer_id', user.id)
      .eq('store_id', STORE_ID)
      .maybeSingle()

    if (error) {
      console.error('[User Order Reorder POST]', error)
      return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Return items that are still available
    const availableItems = order.items
      .filter((item: Record<string, unknown>) => item.product?.is_available && (item.product?.stock_quantity as number) > 0)
      .map((item: Record<string, unknown>) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: (item.product as Record<string, unknown>)?.price,
        product: item.product,
      }))

    const unavailableItems = order.items
      .filter((item: Record<string, unknown>) => !item.product?.is_available || (item.product?.stock_quantity as number) <= 0)
      .map((item: Record<string, unknown>) => ({
        productId: item.product_id,
        productName: item.product_name,
        reason: !item.product?.is_available ? 'No longer available' : 'Out of stock',
      }))

    return NextResponse.json({
      items: availableItems,
      unavailableItems,
      totalItems: availableItems.length,
      unavailableCount: unavailableItems.length,
    })
  } catch (err) {
    console.error('[User Order Reorder POST]', err)
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
  }
}
