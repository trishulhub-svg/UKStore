import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calculateVatFromGross } from '@/lib/vat'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    // Use service client to create the order (bypasses RLS)
    const serviceClient = createServiceClient()

    // Validate items against database (check prices and stock)
    const productIds = items.map((item: { product_id: string }) => item.product_id)
    const { data: dbProducts, error: productsError } = await serviceClient
      .from('products')
      .select('id, name, price, vat_rate, is_available, stock_quantity')
      .in('id', productIds)

    if (productsError) {
      console.error('Error fetching products:', productsError)
      // Continue anyway — the database might not be fully set up
    }

    // If we have database products, validate them
    if (dbProducts && dbProducts.length > 0) {
      const dbProductMap = new Map(dbProducts.map((p: { id: string }) => [p.id, p]))
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

    // Save address if requested
    let addressId: string | null = null
    if (save_address) {
      const { data: newAddress, error: addressError } = await serviceClient
        .from('addresses')
        .insert({
          user_id: user.id,
          address_line_1: address.address_line_1,
          address_line_2: address.address_line_2 || null,
          city: address.city,
          postcode: address.postcode,
          is_default: true,
        })
        .select('id')
        .single()

      if (!addressError && newAddress) {
        addressId = newAddress.id
      }
    }

    // If no address was saved, check if user has a default address
    if (!addressId) {
      const { data: existingAddress } = await serviceClient
        .from('addresses')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .limit(1)
        .single()

      if (existingAddress) {
        addressId = existingAddress.id
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

    // Create the order
    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .insert({
        store_id: STORE_ID,
        customer_id: user.id,
        address_id: addressId,
        status: 'placed',
        subtotal: validatedSubtotal || subtotal,
        vat_amount: validatedVatAmount || vat_amount,
        delivery_fee: delivery_fee,
        total: (validatedSubtotal || subtotal) + delivery_fee,
        stripe_session_id: `mock-session-${Date.now()}`,
        payment_status: 'paid',
        delivery_slot: delivery_slot,
      })
      .select('id')
      .single()

    if (orderError) {
      console.error('Error creating order:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order. Please try again.' },
        { status: 500 }
      )
    }

    // Create order items
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

    const { error: itemsError } = await serviceClient
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      // Order was created, but items failed — still return the order ID
    }

    // Update product stock quantities
    if (dbProducts && dbProducts.length > 0) {
      for (const item of items) {
        const dbProduct = dbProducts.find((p: { id: string }) => p.id === item.product_id)
        if (dbProduct && dbProduct.stock_quantity > 0) {
          await serviceClient
            .from('products')
            .update({ stock_quantity: dbProduct.stock_quantity - item.quantity })
            .eq('id', item.product_id)
        }
      }
    }

    return NextResponse.json({
      orderId: order.id,
      sessionId: `mock-session-${Date.now()}`,
    })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
