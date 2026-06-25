// ============================================================
// Fresh Mart London — Receipt Service
//
// Generates a human-readable receipt number (e.g. "FM-2026-000123")
// and a self-contained HTML receipt when an order's payment status
// transitions to `paid`.
//
// The receipt is stored on the Order row itself (receiptNumber +
// receiptHtml) so it can be re-displayed at any time from the admin
// orders page or the customer's order confirmation page — no
// recomputation, no external storage, no broken links.
//
// Email delivery is attempted via the existing /lib/email service.
// If SMTP/SendGrid is not configured, the receipt is still saved
// to the database (receiptSentAt stays null) and the admin can
// view it from the orders section at any time. When the owner
// later configures email credentials, the receipt can be resent
// manually from the admin order detail panel.
// ============================================================

import { getPrisma } from '@/lib/auth/prisma'
import { sendEmail, isEmailConfigured } from '@/lib/email'
import { formatPrice } from '@/lib/vat'

const STORE_ID = 'store-fresh-mart-001'
const RECEIPT_PREFIX = 'FM'

// ─── Types ─────────────────────────────────────────────────

export interface ReceiptOrderInput {
  id: string
  receiptNumber?: string | null
  subtotal: number
  vatAmount: number
  deliveryFee: number
  discountAmount?: number
  total: number
  paymentMethod?: string | null
  paymentStatus: string
  createdAt: Date | string
  estimatedDeliveryAt?: Date | string | null
  deliverySlot?: Date | string | null
  notes?: string | null
  customer: { name: string | null; email: string; phone?: string | null }
  address?: {
    addressLine1: string
    addressLine2?: string | null
    city: string
    postcode: string
  } | null
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    vatRate: number
    subtotal: number
  }>
}

export interface ReceiptResult {
  receiptNumber: string
  receiptHtml: string
  emailed: boolean
  emailError?: string
}

// ─── Receipt number generator ──────────────────────────────

/**
 * Generate the next sequential receipt number for the current year.
 * Format: `FM-YYYY-NNNNNN` (e.g. `FM-2026-000001`).
 *
 * The sequence is scoped per year — it resets on Jan 1st. We compute
 * the next number by counting how many receipts already exist for
 * the current year. Because SQLite doesn't have a native sequence,
 * we use a count+1 strategy; the `@unique` constraint on
 * `receiptNumber` protects against races (a collision will throw,
 * and the caller can retry).
 */
export async function generateReceiptNumber(): Promise<string> {
  const prisma = await getPrisma()
  const year = new Date().getFullYear()
  const prefix = `${RECEIPT_PREFIX}-${year}-`

  // Count existing receipts with this year's prefix
  const existing = await prisma.order.count({
    where: {
      receiptNumber: { startsWith: prefix },
    },
  })

  const seq = existing + 1
  return `${prefix}${String(seq).padStart(6, '0')}`
}

/**
 * Find a unique receipt number, retrying on collision up to 5 times.
 * Collisions are extremely unlikely (would require two simultaneous
 * payments inside the same race window), but this makes the function
 * safe under concurrent load.
 */
async function generateUniqueReceiptNumber(): Promise<string> {
  const prisma = await getPrisma()
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await generateReceiptNumber()
    const clash = await prisma.order.findUnique({
      where: { receiptNumber: candidate },
      select: { id: true },
    })
    if (!clash) return candidate
    // wait briefly and retry
    await new Promise((r) => setTimeout(r, 50 * (attempt + 1)))
  }
  // Last-resort fallback — append a timestamp slug to guarantee uniqueness
  return `${RECEIPT_PREFIX}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
}

// ─── HTML receipt builder ──────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Build a self-contained HTML receipt for the given order.
 * Inline-styled so it renders correctly in email clients (Gmail,
 * Outlook, Apple Mail) and in the admin/customer viewer without
 * needing any external CSS.
 */
export function buildReceiptHtml(
  order: ReceiptOrderInput,
  store: { name: string; address?: string | null; phone?: string | null; email?: string | null },
  receiptNumber: string,
): string {
  const storeName = escapeHtml(store.name || 'Fresh Mart London')
  const storeAddress = store.address ? escapeHtml(store.address) : ''
  const storePhone = store.phone ? escapeHtml(store.phone) : ''
  const storeEmail = store.email ? escapeHtml(store.email) : ''

  const customerName = escapeHtml(order.customer.name || order.customer.email)
  const customerEmail = escapeHtml(order.customer.email)
  const customerPhone = order.customer.phone ? escapeHtml(order.customer.phone) : ''

  const addressLines: string[] = []
  if (order.address) {
    addressLines.push(escapeHtml(order.address.addressLine1))
    if (order.address.addressLine2) addressLines.push(escapeHtml(order.address.addressLine2))
    addressLines.push(`${escapeHtml(order.address.city)}, ${escapeHtml(order.address.postcode)}`)
  }

  const itemRows = order.items
    .map((item) => {
      const lineTotal = item.subtotal
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(item.productName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.unitPrice)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatPrice(lineTotal)}</td>
        </tr>`
    })
    .join('')

  const discountRow =
    order.discountAmount && order.discountAmount > 0
      ? `<tr>
          <td colspan="3" style="padding:6px 12px;text-align:right;color:#666;">Discount</td>
          <td style="padding:6px 12px;text-align:right;color:#16a34a;font-weight:600;">−${formatPrice(order.discountAmount)}</td>
        </tr>`
      : ''

  const etaText = order.estimatedDeliveryAt
    ? formatDate(order.estimatedDeliveryAt)
    : order.deliverySlot
      ? formatDate(order.deliverySlot)
      : 'To be confirmed'

  const paymentMethodLabel: Record<string, string> = {
    stripe: 'Card (Stripe)',
    cash: 'Cash on Delivery',
    bank_transfer: 'Bank Transfer',
  }
  const payLabel = order.paymentMethod
    ? paymentMethodLabel[order.paymentMethod] || order.paymentMethod
    : 'N/A'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Receipt ${escapeHtml(receiptNumber)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f5f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;background:#16a34a;color:#ffffff;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <div style="font-size:20px;font-weight:700;letter-spacing:-0.3px;">${storeName}</div>
                    <div style="font-size:12px;opacity:0.9;margin-top:2px;">Payment Receipt</div>
                  </td>
                  <td align="right">
                    <div style="font-size:11px;opacity:0.85;text-transform:uppercase;letter-spacing:0.5px;">Receipt No.</div>
                    <div style="font-size:16px;font-weight:700;font-family:'Courier New',monospace;">${escapeHtml(receiptNumber)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Store + meta info -->
          <tr>
            <td style="padding:20px 28px 8px 28px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="vertical-align:top;font-size:13px;color:#666;line-height:1.5;">
                    ${storeAddress ? `${storeAddress}<br>` : ''}
                    ${storePhone ? `Phone: ${storePhone}<br>` : ''}
                    ${storeEmail ? `Email: ${storeEmail}` : ''}
                  </td>
                  <td align="right" style="vertical-align:top;font-size:13px;color:#666;line-height:1.5;">
                    <strong style="color:#1f2937;">Date:</strong> ${formatDate(order.createdAt)}<br>
                    <strong style="color:#1f2937;">Payment:</strong> ${payLabel}<br>
                    <strong style="color:#1f2937;">Order ID:</strong> <span style="font-family:'Courier New',monospace;font-size:12px;">${escapeHtml(order.id)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer block -->
          <tr>
            <td style="padding:16px 28px;">
              <table role="presentation" width="100%" style="background:#f9fafb;border-radius:6px;">
                <tr>
                  <td style="padding:12px 16px;font-size:13px;line-height:1.6;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;margin-bottom:4px;">Billed To</div>
                    <div style="font-weight:600;color:#1f2937;">${customerName}</div>
                    <div style="color:#666;">${customerEmail}</div>
                    ${customerPhone ? `<div style="color:#666;">${customerPhone}</div>` : ''}
                    ${
                      addressLines.length > 0
                        ? `<div style="margin-top:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;">Deliver To</div>
                           ${addressLines.map((l) => `<div style="color:#666;">${l}</div>`).join('')}`
                        : ''
                    }
                  </td>
                  <td style="padding:12px 16px;font-size:13px;line-height:1.6;vertical-align:top;text-align:right;width:40%;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;margin-bottom:4px;">Estimated Delivery</div>
                    <div style="font-weight:600;color:#1f2937;">${escapeHtml(etaText)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items table -->
          <tr>
            <td style="padding:8px 28px 16px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:10px 12px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;">Item</th>
                    <th style="padding:10px 12px;text-align:center;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;">Qty</th>
                    <th style="padding:10px 12px;text-align:right;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;">Unit Price</th>
                    <th style="padding:10px 12px;text-align:right;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:0 28px 20px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
                <tr>
                  <td style="padding:6px 12px;text-align:right;color:#666;">Subtotal</td>
                  <td style="padding:6px 12px;text-align:right;width:120px;">${formatPrice(order.subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 12px;text-align:right;color:#666;">VAT (included)</td>
                  <td style="padding:6px 12px;text-align:right;">${formatPrice(order.vatAmount)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 12px;text-align:right;color:#666;">Delivery Fee</td>
                  <td style="padding:6px 12px;text-align:right;">${formatPrice(order.deliveryFee)}</td>
                </tr>
                ${discountRow}
                <tr>
                  <td style="padding:12px;border-top:2px solid #16a34a;text-align:right;font-weight:700;font-size:15px;color:#1f2937;">Total Paid</td>
                  <td style="padding:12px;border-top:2px solid #16a34a;text-align:right;font-weight:700;font-size:15px;color:#16a34a;">${formatPrice(order.total)}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            order.notes
              ? `<tr><td style="padding:0 28px 16px 28px;">
                  <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:6px;padding:10px 14px;font-size:12px;color:#78350f;">
                    <strong>Note:</strong> ${escapeHtml(order.notes)}
                  </div>
                </td></tr>`
              : ''
          }

          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;text-align:center;">
                Thank you for shopping with ${storeName}.<br>
                Please keep this receipt for your records. For support, contact ${storeEmail || storePhone || 'us'}.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
                Receipt generated on ${formatDate(new Date())}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Main entry point ──────────────────────────────────────

/**
 * Generate (or fetch the existing) receipt for an order and persist
 * it to the database. If email is configured, also send it to the
 * customer.
 *
 * Safe to call multiple times — if a receipt already exists for the
 * order, the existing receipt is returned without regeneration or
 * re-sending. Call `resendReceiptEmail()` to re-send.
 *
 * Returns the receipt number + HTML + email send status.
 */
export async function generateAndSaveReceipt(orderId: string): Promise<ReceiptResult | null> {
  const prisma = await getPrisma()

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      address: true,
      items: true,
      store: { select: { name: true, address: true, phone: true, email: true } },
    },
  })

  if (!order) {
    console.error('[receipt] Order not found:', orderId)
    return null
  }

  // If receipt already exists, return it as-is (don't regenerate)
  if (order.receiptNumber && order.receiptHtml) {
    return {
      receiptNumber: order.receiptNumber,
      receiptHtml: order.receiptHtml,
      emailed: !!order.receiptSentAt,
    }
  }

  // Generate a unique receipt number
  const receiptNumber = await generateUniqueReceiptNumber()

  // Build the HTML receipt
  const receiptHtml = buildReceiptHtml(
    {
      id: order.id,
      subtotal: order.subtotal,
      vatAmount: order.vatAmount,
      deliveryFee: order.deliveryFee,
      discountAmount: order.discountAmount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      estimatedDeliveryAt: order.estimatedDeliveryAt,
      deliverySlot: order.deliverySlot,
      notes: order.notes,
      customer: {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
      },
      address: order.address
        ? {
            addressLine1: order.address.addressLine1,
            addressLine2: order.address.addressLine2,
            city: order.address.city,
            postcode: order.address.postcode,
          }
        : null,
      items: order.items.map((it) => ({
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        vatRate: it.vatRate,
        subtotal: it.subtotal,
      })),
    },
    {
      name: order.store.name,
      address: order.store.address,
      phone: order.store.phone,
      email: order.store.email,
    },
    receiptNumber,
  )

  // Persist receipt to DB
  await prisma.order.update({
    where: { id: orderId },
    data: {
      receiptNumber,
      receiptHtml,
    },
  })

  // Attempt to email it (best-effort)
  let emailed = false
  let emailError: string | undefined
  try {
    const configured = await isEmailConfigured()
    if (!configured) {
      // No-op — receipt is still saved to DB for later viewing
      console.log(`[receipt] Email not configured — receipt ${receiptNumber} saved but not emailed`)
    } else if (!order.customer.email) {
      console.log(`[receipt] Customer has no email — receipt ${receiptNumber} saved but not emailed`)
    } else {
      const result = await sendEmail({
        to: order.customer.email,
        subject: `Receipt ${receiptNumber} — ${order.store.name}`,
        html: receiptHtml,
        text: `Thank you for your order.\n\nReceipt Number: ${receiptNumber}\nOrder ID: ${order.id}\nTotal: ${formatPrice(order.total)}\n\nPlease keep this receipt for your records.`,
      })

      if (result.sent) {
        emailed = true
        await prisma.order.update({
          where: { id: orderId },
          data: { receiptSentAt: new Date() },
        })
        console.log(`[receipt] Emailed receipt ${receiptNumber} to ${order.customer.email}`)
      } else {
        emailError = result.error || result.reason
        console.warn(`[receipt] Email send failed for ${receiptNumber}:`, emailError)
      }
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err)
    console.error(`[receipt] Email send threw for ${receiptNumber}:`, err)
  }

  return { receiptNumber, receiptHtml, emailed, emailError }
}

/**
 * Resend the receipt email for an order that already has a receipt
 * saved. Useful when the owner just configured SMTP and wants to
 * deliver previously-stored receipts. Returns the send result.
 */
export async function resendReceiptEmail(orderId: string): Promise<{
  sent: boolean
  reason?: string
  error?: string
}> {
  const prisma = await getPrisma()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { receiptNumber: true, receiptHtml: true, customer: { select: { email: true } } },
  })

  if (!order || !order.receiptNumber || !order.receiptHtml) {
    return { sent: false, reason: 'no_receipt' }
  }
  if (!order.customer.email) {
    return { sent: false, reason: 'no_recipient' }
  }

  const result = await sendEmail({
    to: order.customer.email,
    subject: `Receipt ${order.receiptNumber}`,
    html: order.receiptHtml,
    text: `Receipt ${order.receiptNumber}`,
  })

  if (result.sent) {
    await prisma.order.update({
      where: { id: orderId },
      data: { receiptSentAt: new Date() },
    })
  }

  return { sent: result.sent, reason: result.reason, error: result.error }
}
