import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { getServerUser } from '@/lib/auth/server'

const STORE_ID = 'store-fresh-mart-001'

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json(
        { valid: false, message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if customer is banned
    const prisma = await getPrisma()
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isActive: true },
    })
    if (dbUser && !dbUser.isActive) {
      return NextResponse.json(
        { valid: false, message: 'Your account has been suspended. Please contact support.' },
        { status: 403 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { valid: false, message: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { code, subtotal, categoryIds } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, message: 'Promo code is required' },
        { status: 400 }
      )
    }

    // Find active promotion with matching code
    const promotion = await prisma.promotion.findFirst({
      where: {
        storeId: STORE_ID,
        code: { equals: code.trim(), mode: 'insensitive' },
        isActive: true,
      },
    })

    if (!promotion) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid promo code. Please check and try again.',
      })
    }

    // Validate: within date range
    const now = new Date()
    if (now < promotion.startDate) {
      return NextResponse.json({
        valid: false,
        message: `This promo code is not yet active. It starts on ${promotion.startDate.toLocaleDateString('en-GB')}.`,
      })
    }
    if (now > promotion.endDate) {
      return NextResponse.json({
        valid: false,
        message: 'This promo code has expired.',
      })
    }

    // Validate: minimum order value
    const orderSubtotal = subtotal || 0
    if (promotion.minimumOrderValue > 0 && orderSubtotal < promotion.minimumOrderValue) {
      return NextResponse.json({
        valid: false,
        message: `Minimum order value of £${promotion.minimumOrderValue.toFixed(2)} required. Your subtotal is £${orderSubtotal.toFixed(2)}.`,
      })
    }

    // Validate: usage limits
    if (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit) {
      return NextResponse.json({
        valid: false,
        message: 'This promo code has reached its usage limit.',
      })
    }

    // Validate: category restrictions
    if (promotion.appliesToCategoryIds && categoryIds && Array.isArray(categoryIds)) {
      try {
        const allowedCategoryIds: string[] = JSON.parse(promotion.appliesToCategoryIds)
        if (allowedCategoryIds.length > 0) {
          const hasApplicableCategory = categoryIds.some((id: string) =>
            allowedCategoryIds.includes(id)
          )
          if (!hasApplicableCategory) {
            return NextResponse.json({
              valid: false,
              message: 'This promo code does not apply to any items in your cart.',
            })
          }
        }
      } catch {
        // If JSON parse fails, skip category check
      }
    }

    // Calculate discount amount
    let discount = 0
    if (promotion.discountType === 'percentage') {
      discount = orderSubtotal * (promotion.discountValue / 100)
      // Cap at subtotal so we don't go negative
      discount = Math.min(discount, orderSubtotal)
    } else if (promotion.discountType === 'fixed_amount') {
      discount = Math.min(promotion.discountValue, orderSubtotal)
    }

    // Round to 2 decimal places
    discount = Math.round(discount * 100) / 100

    return NextResponse.json({
      valid: true,
      discount,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      promotionName: promotion.name,
      promotionId: promotion.id,
      message: promotion.discountType === 'percentage'
        ? `${promotion.discountValue}% off applied!`
        : `£${promotion.discountValue.toFixed(2)} off applied!`,
    })
  } catch (err) {
    console.error('[Promotions Validate]', err)
    return NextResponse.json(
      { valid: false, message: 'Failed to validate promo code. Please try again.' },
      { status: 500 }
    )
  }
}
