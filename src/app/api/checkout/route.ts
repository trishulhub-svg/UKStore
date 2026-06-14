import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { getPrisma } from '@/lib/auth/prisma'
import { calculateVatFromGross } from '@/lib/vat'
import { getStripeConfig, getSetting } from '@/lib/settings'

const STORE_ID = 'store-fresh-mart-001'

function buildApiError(
  message: string,
  code: string,
  status: number,
  details?: string,
  endpoint?: string,
) {
  return NextResponse.json(
    {
      error: message,
      code,
      technicalError: {
        message,
        code,
        status,
        details: details || '',
        timestamp: new Date().toISOString(),
        endpoint: endpoint || '/api/checkout',
      },
    },
    { status }
  )
}

export async function POST(request: NextRequest) {
  const endpoint = '/api/checkout'
  try {
    // Verify authenticated user using local auth
    const user = await getServerUser()

    if (!user) {
      return buildApiError(
        'Authentication required. Please log in and try again.',
        'AUTH_REQUIRED',
        401,
        'No valid session cookie was found. This endpoint requires authentication via the fresh_mart_session cookie.',
        endpoint,
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return buildApiError(
        'Request body is not valid JSON.',
        'INVALID_BODY',
        400,
        'The server could not parse the request body as JSON. Make sure the Content-Type header is set to application/json.',
        endpoint,
      )
    }

    const {
      items,
      address,
      delivery_slot,
      subtotal,
      vat_amount,
      delivery_fee,
      total,
      save_address,
      payment_method: paymentMethod,
      bank_transfer_ref: bankTransferRef,
      promo_code: promoCode,
      promotion_id: promotionId,
      discount_amount: discountAmount,
    } = body

    // Validate cart items
    if (!items || items.length === 0) {
      return buildApiError(
        'Your cart is empty. Add items before checking out.',
        'EMPTY_CART',
        400,
        `Received items array: ${JSON.stringify(items)}`,
        endpoint,
      )
    }

    // Validate address
    if (!address?.address_line_1 || !address?.city || !address?.postcode) {
      return buildApiError(
        'Delivery address is required.',
        'MISSING_ADDRESS',
        400,
        `Address validation failed: address_line_1=${address?.address_line_1 ? 'provided' : 'missing'}, city=${address?.city ? 'provided' : 'missing'}, postcode=${address?.postcode ? 'provided' : 'missing'}`,
        endpoint,
      )
    }

    // Get Prisma client
    const prisma = await getPrisma()

    // Validate items against database (check prices and stock) via Prisma
    let dbProducts: Map<string, { id: string; name: string; price: number; vatRate: number; isAvailable: boolean; stockQuantity: number; isHfss: boolean; isAgeRestricted: boolean; minimumAge: number }> = new Map()
    try {
      const productIds = items.map((item: { product_id: string }) => item.product_id)
      const dbProductRows = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true, vatRate: true, isAvailable: true, stockQuantity: true, isHfss: true, isAgeRestricted: true, minimumAge: true },
      })
      for (const p of dbProductRows) {
        dbProducts.set(p.id, p)
      }
    } catch {
      // Continue anyway — the database might not be fully set up
    }

    // If we have database products, validate them
    if (dbProducts.size > 0) {
      for (const item of items) {
        const dbProduct = dbProducts.get(item.product_id)
        if (dbProduct) {
          if (!dbProduct.isAvailable) {
            return buildApiError(
              `${dbProduct.name} is no longer available.`,
              'PRODUCT_UNAVAILABLE',
              400,
              `Product ID: ${dbProduct.id}, Name: ${dbProduct.name}, is_available: ${dbProduct.isAvailable}`,
              endpoint,
            )
          }
          if (dbProduct.stockQuantity < item.quantity) {
            return buildApiError(
              `${dbProduct.name} has insufficient stock (only ${dbProduct.stockQuantity} available).`,
              'INSUFFICIENT_STOCK',
              400,
              `Product ID: ${dbProduct.id}, Name: ${dbProduct.name}, Requested: ${item.quantity}, Available: ${dbProduct.stockQuantity}`,
              endpoint,
            )
          }
          // Use the database price (not the client-submitted price)
          item.unit_price = dbProduct.price
          item.vat_rate = dbProduct.vatRate
        }
      }
    }

    // ─── Challenge 25 Detection ─────────────────────────────────
    // Check if any items require age verification:
    //   - isAgeRestricted = true (alcohol, tobacco, knives, solvents, etc.)
    //   - isHfss = true with minimumAge >= 16 (energy drinks, some HFSS items)
    const requiresChallenge25 =
      items.some((item: { product_id: string }) => {
        const dbProduct = dbProducts.get(item.product_id)
        return dbProduct?.isAgeRestricted === true || (dbProduct?.isHfss === true && (dbProduct?.minimumAge || 0) >= 16)
      }) ||
      items.some((item: { is_age_restricted?: boolean; is_hfss?: boolean }) =>
        item.is_age_restricted === true
      )

    // Determine the minimum age required for this order (highest across all items)
    let orderMinAge = 0
    const ageRestrictedItemNames: string[] = []
    for (const item of items) {
      const dbProduct = dbProducts.get(item.product_id)
      const itemMinAge = dbProduct?.minimumAge || 0
      if (dbProduct?.isAgeRestricted || itemMinAge >= 16) {
        orderMinAge = Math.max(orderMinAge, itemMinAge || 18)
        ageRestrictedItemNames.push(item.product_name || dbProduct?.name || 'Unknown product')
      }
    }
    // Default to 18 if we have age-restricted items but no specific age
    if (orderMinAge === 0 && requiresChallenge25) {
      orderMinAge = 18
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
    const finalDiscount = discountAmount || 0
    const finalTotal = finalSubtotal + delivery_fee - finalDiscount

    // Save address if requested and user is authenticated
    let addressId: string | null = null
    try {
      // Check if user already has this address
      const existingAddress = await prisma.address.findFirst({
        where: {
          userId: user.id,
          addressLine1: address.address_line_1,
          postcode: address.postcode,
        },
      })

      if (existingAddress) {
        addressId = existingAddress.id
      } else if (save_address) {
        // Create new address
        const newAddress = await prisma.address.create({
          data: {
            userId: user.id,
            label: address.label || null,
            addressLine1: address.address_line_1,
            addressLine2: address.address_line_2 || null,
            city: address.city,
            postcode: address.postcode,
            latitude: address.latitude || null,
            longitude: address.longitude || null,
            isDefault: false,
          },
        })
        addressId = newAddress.id
      } else {
        // Create a temporary address for the order
        const tempAddress = await prisma.address.create({
          data: {
            userId: user.id,
            addressLine1: address.address_line_1,
            addressLine2: address.address_line_2 || null,
            city: address.city,
            postcode: address.postcode,
            latitude: address.latitude || null,
            longitude: address.longitude || null,
            isDefault: false,
          },
        })
        addressId = tempAddress.id
      }
    } catch {
      // Address creation failed — continue without address_id
    }

    // ─── Payment Method: Cash on Delivery ───────────────────────
    if (paymentMethod === 'cash') {
      try {
        // Validate promo code if provided
        let validatedPromoId: string | null = promotionId || null
        let validatedDiscount = finalDiscount
        if (promoCode) {
          try {
            const promo = await prisma.promotion.findFirst({
              where: { storeId: STORE_ID, code: { equals: promoCode, mode: 'insensitive' }, isActive: true },
            })
            if (promo) {
              validatedPromoId = promo.id
              // Increment usage count
              await prisma.promotion.update({
                where: { id: promo.id },
                data: { usedCount: { increment: 1 } },
              })
            }
          } catch { /* non-critical */ }
        }

        const order = await prisma.order.create({
          data: {
            storeId: STORE_ID,
            customerId: user.id,
            addressId: addressId || '',
            status: 'placed',
            subtotal: finalSubtotal,
            vatAmount: finalVatAmount,
            deliveryFee: delivery_fee,
            total: finalTotal,
            stripeSessionId: `cash-${Date.now()}`,
            paymentStatus: 'pending',
            paymentMethod: 'cash',
            hasChallenge25: requiresChallenge25,
            deliverySlot: delivery_slot ? new Date(delivery_slot) : null,
            promotionId: validatedPromoId,
            discountAmount: validatedDiscount,
            items: {
              create: items.map((item: { product_id: string; product_name: string; quantity: number; unit_price: number; vat_rate: number; substitute_preference: string }) => {
                const itemGross = item.unit_price * item.quantity
                const itemVat = calculateVatFromGross(itemGross, item.vat_rate)
                return {
                  productId: item.product_id,
                  productName: item.product_name,
                  quantity: item.quantity,
                  unitPrice: item.unit_price,
                  vatRate: item.vat_rate,
                  vatAmount: itemVat,
                  subtotal: itemGross,
                  substitutePreference: item.substitute_preference || 'closest_match',
                  picked: false,
                }
              }),
            },
          },
        })

        return NextResponse.json({
          orderId: order.id,
          paymentMethod: 'cash',
          message: 'Order placed. Payment will be collected on delivery.',
        })
      } catch (err) {
        console.error('[Checkout] Cash order creation failed:', err)
        return buildApiError(
          'Failed to create cash order.',
          'ORDER_CREATE_FAILED',
          500,
          String(err),
          endpoint,
        )
      }
    }

    // ─── Payment Method: Bank Transfer ──────────────────────────
    if (paymentMethod === 'bank_transfer') {
      try {
        // Validate promo code if provided
        let validatedPromoId: string | null = promotionId || null
        let validatedDiscount = finalDiscount
        if (promoCode) {
          try {
            const promo = await prisma.promotion.findFirst({
              where: { storeId: STORE_ID, code: { equals: promoCode, mode: 'insensitive' }, isActive: true },
            })
            if (promo) {
              validatedPromoId = promo.id
              await prisma.promotion.update({
                where: { id: promo.id },
                data: { usedCount: { increment: 1 } },
              })
            }
          } catch { /* non-critical */ }
        }

        const order = await prisma.order.create({
          data: {
            storeId: STORE_ID,
            customerId: user.id,
            addressId: addressId || '',
            status: 'placed',
            subtotal: finalSubtotal,
            vatAmount: finalVatAmount,
            deliveryFee: delivery_fee,
            total: finalTotal,
            stripeSessionId: `bank-${Date.now()}`,
            paymentStatus: 'pending',
            paymentMethod: 'bank_transfer',
            bankTransferRef: bankTransferRef || null,
            bankTransferVerified: false,
            hasChallenge25: requiresChallenge25,
            deliverySlot: delivery_slot ? new Date(delivery_slot) : null,
            promotionId: validatedPromoId,
            discountAmount: validatedDiscount,
            items: {
              create: items.map((item: { product_id: string; product_name: string; quantity: number; unit_price: number; vat_rate: number; substitute_preference: string }) => {
                const itemGross = item.unit_price * item.quantity
                const itemVat = calculateVatFromGross(itemGross, item.vat_rate)
                return {
                  productId: item.product_id,
                  productName: item.product_name,
                  quantity: item.quantity,
                  unitPrice: item.unit_price,
                  vatRate: item.vat_rate,
                  vatAmount: itemVat,
                  subtotal: itemGross,
                  substitutePreference: item.substitute_preference || 'closest_match',
                  picked: false,
                }
              }),
            },
          },
        })

        // Get bank details from settings
        const bankSortCode = await getSetting('bank_sort_code', 'BANK_SORT_CODE', '')
        const bankAccountNumber = await getSetting('bank_account_number', 'BANK_ACCOUNT_NUMBER', '')
        const bankAccountName = await getSetting('bank_account_name', 'BANK_ACCOUNT_NAME', '')

        return NextResponse.json({
          orderId: order.id,
          paymentMethod: 'bank_transfer',
          bankDetails: {
            sortCode: bankSortCode,
            accountNumber: bankAccountNumber,
            accountName: bankAccountName,
          },
          message: 'Order placed. Please complete the bank transfer to confirm payment.',
        })
      } catch (err) {
        console.error('[Checkout] Bank transfer order creation failed:', err)
        return buildApiError(
          'Failed to create bank transfer order.',
          'ORDER_CREATE_FAILED',
          500,
          String(err),
          endpoint,
        )
      }
    }

    // ─── Payment Method: Card (Stripe) ──────────────────────────
    // If Stripe is configured, create a real Checkout Session
    const stripeConfig = await getStripeConfig()

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

        // Create the order first so we have an orderId for the webhook
        const order = await prisma.order.create({
          data: {
            storeId: STORE_ID,
            customerId: user.id,
            addressId: addressId || '',
            status: 'placed',
            subtotal: finalSubtotal,
            vatAmount: finalVatAmount,
            deliveryFee: delivery_fee,
            total: finalTotal,
            stripeSessionId: 'pending', // Will update after session is created
            paymentStatus: 'pending',
            paymentMethod: 'stripe',
            hasChallenge25: requiresChallenge25,
            deliverySlot: delivery_slot ? new Date(delivery_slot) : null,
            promotionId: promotionId || null,
            discountAmount: finalDiscount,
            items: {
              create: items.map((item: { product_id: string; product_name: string; quantity: number; unit_price: number; vat_rate: number; substitute_preference: string }) => {
                const itemGross = item.unit_price * item.quantity
                const itemVat = calculateVatFromGross(itemGross, item.vat_rate)
                return {
                  productId: item.product_id,
                  productName: item.product_name,
                  quantity: item.quantity,
                  unitPrice: item.unit_price,
                  vatRate: item.vat_rate,
                  vatAmount: itemVat,
                  subtotal: itemGross,
                  substitutePreference: item.substitute_preference || 'closest_match',
                  picked: false,
                }
              }),
            },
          },
        })

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'payment',
          success_url: `${origin}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/checkout?cancelled=true`,
          metadata: {
            store_id: STORE_ID,
            customer_id: user.id,
            orderId: order.id,
            delivery_slot: delivery_slot || '',
          },
          payment_intent_data: {
            metadata: {
              store_id: STORE_ID,
              customer_id: user.id,
              orderId: order.id,
            },
          },
        })

        // Update the order with the real Stripe session ID
        await prisma.order.update({
          where: { id: order.id },
          data: { stripeSessionId: session.id },
        })

        return NextResponse.json({
          orderId: order.id,
          sessionId: session.id,
          checkoutUrl: session.url,
        })
      } catch (stripeError) {
        console.error('Stripe error:', stripeError)
        // Fall through to demo mode if Stripe fails
      }
    }

    // Demo mode: Create order in Prisma
    try {
      // Validate promo code if provided
      if (promoCode) {
        try {
          const promo = await prisma.promotion.findFirst({
            where: { storeId: STORE_ID, code: { equals: promoCode, mode: 'insensitive' }, isActive: true },
          })
          if (promo) {
            await prisma.promotion.update({
              where: { id: promo.id },
              data: { usedCount: { increment: 1 } },
            })
          }
        } catch { /* non-critical */ }
      }

      const order = await prisma.order.create({
        data: {
          storeId: STORE_ID,
          customerId: user.id,
          addressId: addressId || '',
          status: 'placed',
          subtotal: finalSubtotal,
          vatAmount: finalVatAmount,
          deliveryFee: delivery_fee,
          total: finalTotal,
          stripeSessionId: `demo-session-${Date.now()}`,
          paymentStatus: 'paid',
          paymentMethod: 'stripe',
          hasChallenge25: requiresChallenge25,
          deliverySlot: delivery_slot ? new Date(delivery_slot) : null,
          promotionId: promotionId || null,
          discountAmount: finalDiscount,
          items: {
            create: items.map((item: { product_id: string; product_name: string; quantity: number; unit_price: number; vat_rate: number; substitute_preference: string }) => {
              const itemGross = item.unit_price * item.quantity
              const itemVat = calculateVatFromGross(itemGross, item.vat_rate)
              return {
                productId: item.product_id,
                productName: item.product_name,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                vatRate: item.vat_rate,
                vatAmount: itemVat,
                subtotal: itemGross,
                substitutePreference: item.substitute_preference || 'closest_match',
                picked: false,
              }
            }),
          },
        },
      })

      return NextResponse.json({
        orderId: order.id,
        sessionId: `demo-session-${Date.now()}`,
        demoMode: true,
      })
    } catch (err) {
      console.error('[Checkout] Failed to create order in Prisma:', err)
    }

    // Fallback: return demo response without database
    return NextResponse.json({
      orderId: `demo-${Date.now()}`,
      sessionId: `demo-session-${Date.now()}`,
      demoMode: true,
    })
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack || '' : ''
    console.error('Checkout error:', err)
    return buildApiError(
      'An internal server error occurred during checkout.',
      'INTERNAL_ERROR',
      500,
      `Error: ${errMessage}\n${errStack}`,
      endpoint,
    )
  }
}
