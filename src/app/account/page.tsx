import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getDefaultStore } from '@/lib/supabase/queries'
import { AccountClient } from '@/components/customer/account-client'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

const STORE_ID = 'store-fresh-mart-001'

export default async function AccountPage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/account')
  }

  const store = await getDefaultStore()

  // Fetch user orders from Prisma
  let orders: Order[] = []
  try {
    const prisma = await getPrisma()
    const dbOrders = await prisma.order.findMany({
      where: { customerId: user.id, storeId: STORE_ID },
      include: {
        items: {
          include: {
            product: { select: { name: true, imageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    orders = dbOrders.map((o) => ({
      id: o.id,
      store_id: o.storeId,
      customer_id: o.customerId,
      driver_id: o.driverId,
      address_id: o.addressId,
      status: o.status as Order['status'],
      subtotal: o.subtotal,
      vat_amount: o.vatAmount,
      delivery_fee: o.deliveryFee,
      total: o.total,
      stripe_session_id: o.stripeSessionId,
      stripe_payment_intent_id: o.stripePaymentIntentId,
      payment_status: o.paymentStatus as Order['payment_status'],
      delivery_slot: o.deliverySlot?.toISOString() ?? null,
      notes: o.notes,
      created_at: o.createdAt.toISOString(),
      updated_at: o.updatedAt.toISOString(),
    }))
  } catch (err) {
    console.warn('[Account Page] Failed to fetch orders:', err)
  }

  return (
    <AccountClient
      storeName={store?.name || 'Fresh Mart'}
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date().toISOString(),
        role: user.role,
      }}
      orders={orders}
    />
  )
}
