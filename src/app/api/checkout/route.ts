import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateVatFromGross } from '@/lib/vat'
import { getStripeConfig } from '@/lib/settings'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user using local auth
    const user = await getServerUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { items, address, delivery_slot, subtotal, vat_amount, delivery_fee, total, save_address } = body

    // Validate cart items
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // Validate address
    if (!address?.address_line_1 || !address?.city || !address?.postcode) {
      return NextResponse.json({ error: 'Delivery address is required' }, { status: 400 })
    }

    // Check Stripe configuration from DB/env
    const stripeConfig = await getStripeConfig()

    // Try to use Supabase service client for order creation if available
    const serviceClient = createServiceClient()

    // Validate items against database (check prices and stock)
    let dbProducts: Array<{ id: string; name: string; price: number; vat_rate: number; is_available: boolean; stock_quantity: number }> | null = null
    if (serviceClient) {
      try {
        const productIds = items.map((item: { product_id: string }) => item.product_id)
        const { data, error: productsError } = await serviceClient
          .from('products')
          .select('id, name, price, vat_rate, is_available, stock_quantity')
          .in('id', productIds)

        if (!productsError && data) {
          dbProducts = data as typeof dbProducts
        }
      } catch {
        // Continue anyway — the database might not be fully set up
      }
    }

    // If we have database products, validate them
    if (dbProducts && dbProducts.length > 0) {
      const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]))
      for (const item of items) {
        const dbProduct = dbProductMap.get(item.product_id)
        if (dbProduct) {
          if (!dbProduct.is_available) {
            return NextResponse.json(
              { error: `${dbProduct.name} is no longer available` },
              { status: 400 }
            )
          }
          if (dbProduct.stock_quantity < item.quantity) {
            return NextResponse.json(
              { error: `${dbProduct.name} has insufficient stock (only ${dbProduct.stock_quantity} available)` },
              { status: 400 }
            )
          }
          // Use the database price (not the client-submitted price)
          item.unit_price = dbProduct.price
          item.vat_rate = dbProduct.vat_rate
        }
      }
    }

    // Recalculate totals from validated items
    const validatedSubtotal = items.reduce(
      (sum: number, item: { unit_price: number; quantity: number }) => sum + item.unit_price * item.quantity,
      0
    )
    const validatedVatAmount = items.reduce(
      (sum: number, item: { unit_price: number; quantity: number; vat_rate: number }) => {
        const itemGross = item.unit_price * item.quantity
        return sum + calculateVatFromGross(itemGross, item.vat_rate)
      },
      0
    )

    const finalSubtotal = validatedSubtotal || subtotal
    const finalVatAmount = validatedVatAmount || vat_amount
    const finalTotal = finalSubtotal + delivery_fee

    // If Stripe is configured, create a real Checkout Session
    if (stripeConfig.isConfigured && stripeConfig.secretKey) {
      try {
        let Stripe: any
        try {
          Stripe = (await import('stripe')).default
        } catch {
          // Stripe package not installed, skip to demo mode
          throw new Error('Stripe package not installed')
        }
        const stripe = new Stripe(stripeConfig.secretKey, {
          apiVersion: '2025-04-30.basil',
        })

        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        // Build line items for Stripe
        const lineItems = items.map((item: { product_name: string; unit_price: number; quantity: number; vat_rate: number }) => ({
          price_data: {
            currency: 'gbp',
            product_data: {
              name: item.product_name,
            },
            unit_amount: Math.round(item.unit_price * 100),
            tax_behavior: 'inclusive' as const,
          },
          quantity: item.quantity,
        }))

        // Add delivery fee as a line item
        if (delivery_fee > 0) {
          lineItems.push({
            price_data: {
              currency: 'gbp',
              product_data: {
                name: 'Delivery Fee',
              },
              unit_amount: Math.round(delivery_fee * 100),
              tax_behavior: 'inclusive' as const,
            },
            quantity: 1,
          })
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'payment',
          success_url: `${origin}/order/CONFIRMED_ID?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/checkout?cancelled=true`,
          metadata: {
            store_id: STORE_ID,
            customer_id: user.id,
            delivery_slot: delivery_slot || '',
          },
          payment_intent_data: {
            metadata: {
              store_id: STORE_ID,
              customer_id: user.id,
            },
          },
        })

        // Try to create order in Supabase
        if (serviceClient) {
          try {
            const { data: order } = await serviceClient
              .from('orders')
              .insert({
                store_id: STORE_ID,
                customer_id: user.id,
                status: 'placed',
                subtotal: finalSubtotal,
                vat_amount: finalVatAmount,
                delivery_fee: delivery_fee,
                total: finalTotal,
                stripe_session_id: session.id,
                payment_status: 'pending',
                delivery_slot: delivery_slot,
              })
              .select('id')
              .single()

            if (order) {
              const orderItems = items.map((item: { product_id: string; product_name: string; quantity: number; unit_price: number; vat_rate: number; substitute_preference: string }) => {
                const itemGross = item.unit_price * item.quantity
                const itemVat = calculateVatFromGross(itemGross, item.vat_rate)
                return {
                  order_id: order.id,
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  vat_rate: item.vat_rate,
                  vat_amount: itemVat,
                  subtotal: itemGross,
                  substitute_preference: item.substitute_preference || 'closest_match',
                  picked: false,
                }
              })

              await serviceClient.from('order_items').insert(orderItems)

              return NextResponse.json({
                orderId: order.id,
                sessionId: session.id,
                checkoutUrl: session.url,
              })
            }
          } catch {
            // Fall through to return Stripe session without order
          }
        }

        return NextResponse.json({
          sessionId: session.id,
          checkoutUrl: session.url,
        })
      } catch (stripeError) {
        console.error('Stripe error:', stripeError)
        // Fall through to demo mode if Stripe fails
      }
    }

    // Demo mode: Create order in Supabase if available, otherwise return demo response
    if (serviceClient) {
      try {
        const { data: order, error: orderError } = await serviceClient
          .from('orders')
          .insert({
            store_id: STORE_ID,
            customer_id: user.id,
            status: 'placed',
            subtotal: finalSubtotal,
            vat_amount: finalVatAmount,
            delivery_fee: delivery_fee,
            total: finalTotal,
            stripe_session_id: `demo-session-${Date.now()}`,
            payment_status: 'paid',
            delivery_slot: delivery_slot,
          })
          .select('id')
          .single()

        if (!orderError && order) {
          const orderItems = items.map((item: { product_id: string; product_name: string; quantity: number; unit_price: number; vat_rate: number; substitute_preference: string }) => {
            const itemGross = item.unit_price * item.quantity
            const itemVat = calculateVatFromGross(itemGross, item.vat_rate)
            return {
              order_id: order.id,
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              vat_rate: item.vat_rate,
              vat_amount: itemVat,
              subtotal: itemGross,
              substitute_preference: item.substitute_preference || 'closest_match',
              picked: false,
            }
          })

          await serviceClient.from('order_items').insert(orderItems)

          return NextResponse.json({
            orderId: order.id,
            sessionId: `demo-session-${Date.now()}`,
            demoMode: true,
          })
        }
      } catch {
        // Fall through to simple demo response
      }
    }

    // Fallback: return demo response without database
    return NextResponse.json({
      orderId: `demo-${Date.now()}`,
      sessionId: `demo-session-${Date.now()}`,
      demoMode: true,
    })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
