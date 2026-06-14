import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getDefaultStore } from '@/lib/supabase/queries'
import { OrderConfirmationClient } from '@/components/customer/order-confirmation-client'
import { notFound } from 'next/navigation'
import type { Order, OrderItem, Address } from '@/types'

interface OrderPageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function OrderConfirmationPage({ params }: OrderPageProps) {
  const { id } = await params
  const store = await getDefaultStore()

  // Fetch order from Supabase
  try {
    const supabase = getSupabaseAdmin()

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*), address:addresses(*)')
      .eq('id', id)
      .single()

    if (error || !order) {
      console.error('[Order Page] Failed to fetch order:', error?.message)
      notFound()
    }

    // Supabase returns snake_case directly — map to frontend Order type
    const mappedOrder: Order = {
      id: order.id,
      store_id: order.store_id,
      customer_id: order.customer_id,
      driver_id: order.driver_id,
      address_id: order.address_id,
      status: order.status as Order['status'],
      subtotal: order.subtotal,
      vat_amount: order.vat_amount,
      delivery_fee: order.delivery_fee,
      total: order.total,
      stripe_session_id: order.stripe_session_id,
      stripe_payment_intent_id: order.stripe_payment_intent_id,
      payment_status: order.payment_status as Order['payment_status'],
      delivery_slot: order.delivery_slot,
      notes: order.notes,
      created_at: order.created_at,
      updated_at: order.updated_at,
    }

    // Supabase returns snake_case directly — map order items
    const mappedItems: OrderItem[] = (order.items || []).map((item: any) => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      vat_amount: item.vat_amount,
      subtotal: item.subtotal,
      substitute_preference: item.substitute_preference,
      substituted_with: item.substituted_with,
      picked: item.picked,
    }))

    // Map address to frontend type
    let mappedAddress: Address | null = null
    if (order.address) {
      mappedAddress = {
        id: order.address.id,
        user_id: order.address.user_id,
        label: order.address.label,
        address_line_1: order.address.address_line_1,
        address_line_2: order.address.address_line_2,
        city: order.address.city,
        postcode: order.address.postcode,
        latitude: order.address.latitude,
        longitude: order.address.longitude,
        is_default: order.address.is_default,
        created_at: order.address.created_at,
      }
    }

    return (
      <OrderConfirmationClient
        order={mappedOrder}
        orderItems={mappedItems}
        address={mappedAddress}
        storeName={store?.name}
      />
    )
  } catch (err) {
    console.error('[Order Page] Failed to fetch order:', err)
    notFound()
  }
}
