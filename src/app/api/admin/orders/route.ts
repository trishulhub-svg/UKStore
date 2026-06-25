import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { getServerUser } from '@/lib/auth/server'
import { sendOrderStatusEmail } from '@/lib/email'
import { generateAndSaveReceipt } from '@/lib/receipt'

const STORE_ID = 'store-fresh-mart-001'

/**
 * Order status state machine — defines which transitions are allowed.
 *
 * Flow:
 *   placed → picking → ready → out_for_delivery → delivered
 *   Any non-delivered status → cancelled (cancellation)
 *   delivered/cancelled are terminal (no further transitions)
 *
 * ADMIN (owner/manager) can make any allowed forward transition.
 * PICKER can do: placed → picking, picking → ready (via picker API).
 * DRIVER can do: out_for_delivery → delivered (via driver deliver API).
 *
 * This guard prevents invalid jumps like placed → delivered (skipping steps).
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  placed: ['picking', 'cancelled'],
  picking: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [], // terminal
  cancelled: [], // terminal
}

function isTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return false // no-op
  const allowed = ALLOWED_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

// GET /api/admin/orders — list orders with filters
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin({ feature: 'orders' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const paymentMethod = searchParams.get('paymentMethod')
    const bankTransferVerified = searchParams.get('bankTransferVerified')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = { storeId: STORE_ID }
    if (status) where.status = status
    if (paymentMethod) where.paymentMethod = paymentMethod
    if (bankTransferVerified !== null) where.bankTransferVerified = bankTransferVerified === 'true'
    if (search) {
      // Search by order ID, receipt number, customer email, or customer name.
      // Receipt numbers look like "FM-2026-000123" — also match case-insensitively
      // when the user types the numeric part only (e.g. "000123" or "123").
      const searchUpper = search.toUpperCase()
      where.OR = [
        { id: { contains: search } },
        { receiptNumber: { contains: searchUpper } },
        { customer: { email: { contains: search } } },
        { customer: { name: { contains: search } } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          driver: { select: { id: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({ orders, total, page, limit })
  } catch (err) {
    console.error('[Admin Orders GET]', err)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// PATCH /api/admin/orders — update order status (with state-machine guard + audit log)
export async function PATCH(request: NextRequest) {
  const { error, user } = await requireAdmin({ feature: 'orders' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const body = await request.json()
    const { orderId, status, driverId, estimatedDeliveryAt } = body

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const existing = await prisma.order.findFirst({ where: { id: orderId, storeId: STORE_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ─── State-machine guard ────────────────────────────────────
    // If a status change is requested, validate the transition is allowed.
    let statusChanged = false
    let fromStatus = existing.status
    let toStatus = existing.status
    if (status && status !== existing.status) {
      if (!isTransitionAllowed(existing.status, status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition: ${existing.status} → ${status}. Allowed next statuses from "${existing.status}": ${(ALLOWED_TRANSITIONS[existing.status] || []).join(', ') || 'none (terminal state)'}`,
            code: 'INVALID_STATUS_TRANSITION',
            fromStatus: existing.status,
            toStatus: status,
            allowed: ALLOWED_TRANSITIONS[existing.status] || [],
          },
          { status: 400 }
        )
      }
      statusChanged = true
      fromStatus = existing.status
      toStatus = status
    }

    // ─── Build the update payload ───────────────────────────────
    const data: any = {}
    if (status) data.status = status
    if (driverId !== undefined) data.driverId = driverId || null
    if (body.bankTransferVerified !== undefined) data.bankTransferVerified = body.bankTransferVerified

    // ETA — accept ISO string, Date, null (to clear), or numeric minutes-from-now.
    // When a driver is assigned, the admin sets an approximate delivery time so
    // we can show "Expected delivery by HH:MM" on the customer tracking page
    // and populate the {eta} placeholder in the out-for-delivery email.
    if (estimatedDeliveryAt !== undefined) {
      if (estimatedDeliveryAt === null) {
        data.estimatedDeliveryAt = null
      } else if (typeof estimatedDeliveryAt === 'string') {
        const parsed = new Date(estimatedDeliveryAt)
        if (!isNaN(parsed.getTime())) data.estimatedDeliveryAt = parsed
      } else if (typeof estimatedDeliveryAt === 'number') {
        // Treat as "minutes from now" — convenient for the UI
        data.estimatedDeliveryAt = new Date(Date.now() + estimatedDeliveryAt * 60_000)
      }
    }

    // Auto-set timestamp fields based on the new status
    if (status === 'picking' && !existing.packedAt) {
      // Picking has started — leave packedAt unset; it's set when moving to ready
    }
    if (status === 'ready' && !existing.packedAt) {
      data.packedAt = new Date()
    }
    if (status === 'out_for_delivery' && !existing.dispatchedAt) {
      data.dispatchedAt = new Date()
    }
    if (status === 'delivered' && !existing.deliveredAt) {
      data.deliveredAt = new Date()
    }

    // ─── Cash-on-delivery receipt ──────────────────────────────
    // For cash orders, the customer pays when the order is delivered.
    // Mark paymentStatus as 'paid' when the order moves to 'delivered'
    // so finance reports stay accurate, and generate a receipt at that
    // point (consistent with card / bank-transfer flows above).
    if (
      status === 'delivered' &&
      existing.paymentMethod === 'cash' &&
      existing.paymentStatus !== 'paid'
    ) {
      data.paymentStatus = 'paid'
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        driver: { select: { id: true, name: true } },
        items: true,
      },
    })

    // ─── Audit log entry ────────────────────────────────────────
    if (statusChanged) {
      try {
        // Build a human-readable note
        let note: string | null = null
        if (driverId !== undefined && status === 'out_for_delivery') {
          if (driverId) {
            // Look up driver name (best-effort)
            const driver = await prisma.user.findUnique({
              where: { id: driverId },
              select: { name: true, email: true },
            })
            note = driver ? `Driver assigned: ${driver.name || driver.email}` : 'Driver assigned'
          } else {
            note = 'Driver unassigned'
          }
        }

        await prisma.orderStatusLog.create({
          data: {
            orderId,
            fromStatus,
            toStatus,
            changedById: user.id,
            note,
          },
        })
      } catch (logErr) {
        // Non-fatal — the status change itself succeeded
        console.error('[Admin Orders PATCH] Failed to write audit log:', logErr)
      }
    }

    // ─── Email notification to customer ────────────────────────
    // Fire-and-forget. sendOrderStatusEmail() gracefully no-ops if no
    // email provider is configured (the owner hasn't entered SMTP creds yet),
    // and always creates an in-app Notification row as a backup channel.
    if (statusChanged) {
      sendOrderStatusEmail(toStatus, {
        orderId: order.id,
        customerName: order.customer.name || order.customer.email,
        customerEmail: order.customer.email,
        total: `£${order.total.toFixed(2)}`,
        driverName: order.driver?.name,
        eta: order.estimatedDeliveryAt,
      }, { userId: order.customer.id }).catch((err) => {
        console.error('[Admin Orders PATCH] sendOrderStatusEmail failed:', err)
      })
    }

    // ─── Receipt generation for cash-on-delivery ───────────────
    // When a cash order is marked delivered, the payment is now complete —
    // generate a receipt (idempotent — no-ops if one already exists).
    if (
      status === 'delivered' &&
      existing.paymentMethod === 'cash' &&
      !existing.receiptNumber
    ) {
      generateAndSaveReceipt(order.id).catch((err) => {
        console.error(`[Admin Orders PATCH] Receipt generation failed for order ${order.id}:`, err)
      })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[Admin Orders PATCH]', err)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
