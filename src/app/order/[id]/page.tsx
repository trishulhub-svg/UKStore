import { createServiceClient } from '@/lib/supabase/server'
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
  const supabase = createServiceClient()
  const store = await getDefaultStore()

  // Fetch the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    notFound()
  }

  // Fetch order items
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id)

  // Fetch address
  let address: Address | null = null
  if ((order as Order).address_id) {
    const { data: addressData } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', (order as Order).address_id)
      .single()
    if (addressData) {
      address = addressData as Address
    }
  }

  return (
    <OrderConfirmationClient
      order={order as Order}
      orderItems={(orderItems as OrderItem[]) || []}
      address={address}
      storeName={store?.name}
    />
  )
}
