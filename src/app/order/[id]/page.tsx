import { getPrisma } from '@/lib/auth/prisma'
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

  // Fetch order from Prisma
  try {
    const prisma = await getPrisma()
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        address: true,
      },
    })

    if (!order) {
      notFound()
    }

    // Map Prisma order to frontend type
    const mappedOrder: Order = {
      id: order.id,
      store_id: order.storeId,
      customer_id: order.customerId,
      driver_id: order.driverId,
      address_id: order.addressId,
      status: order.status as Order['status'],
      subtotal: order.subtotal,
      vat_amount: order.vatAmount,
      delivery_fee: order.deliveryFee,
      total: order.total,
      stripe_session_id: order.stripeSessionId,
      stripe_payment_intent_id: order.stripePaymentIntentId,
      payment_status: order.paymentStatus as Order['payment_status'],
      delivery_slot: order.deliverySlot?.toISOString() ?? null,
      notes: order.notes,
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
    }

    // Map Prisma order items to frontend type
    const mappedItems: OrderItem[] = order.items.map((item) => ({
      id: item.id,
      order_id: item.orderId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      vat_rate: item.vatRate,
      vat_amount: item.vatAmount,
      subtotal: item.subtotal,
      substitute_preference: item.substitutePreference,
      substituted_with: item.substitutedWith,
      picked: item.picked,
    }))

    // Map Prisma address to frontend type
    let mappedAddress: Address | null = null
    if (order.address) {
      mappedAddress = {
        id: order.address.id,
        user_id: order.address.userId,
        label: order.address.label,
        address_line_1: order.address.addressLine1,
        address_line_2: order.address.addressLine2,
        city: order.address.city,
        postcode: order.address.postcode,
        latitude: order.address.latitude,
        longitude: order.address.longitude,
        is_default: order.address.isDefault,
        created_at: order.address.createdAt.toISOString(),
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
