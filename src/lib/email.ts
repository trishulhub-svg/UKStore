// ============================================================
// Fresh Mart London — Email Service
//
// Owner-configurable transactional email system. Reads SMTP or
// SendGrid credentials from the StoreSetting table (configured
// via the admin UI at /admin/settings). When no provider is
// configured, all send functions silently no-op (return
// `{ sent: false, reason: 'not_configured' }`) — the rest of
// the application continues to work normally.
//
// Supported providers (in priority order):
//   1. SMTP  — settings: smtp_host, smtp_port, smtp_user,
//              smtp_pass, smtp_secure, smtp_from_email
//   2. SendGrid — settings: sendgrid_api_key, smtp_from_email
//              (uses SendGrid's HTTP API, no SMTP needed)
//
// All settings are read via the cached getSettings() helper, so
// there's no DB hit on every send after the first one.
// ============================================================

import { getPrisma } from '@/lib/auth/prisma'
import { getSetting } from '@/lib/settings'

const STORE_ID = 'store-fresh-mart-001'

// ─── Types ─────────────────────────────────────────────────

export interface EmailResult {
  sent: boolean
  reason?: 'not_configured' | 'no_recipient' | 'smtp_error' | 'sendgrid_error' | 'success'
  error?: string
  messageId?: string
}

export interface SendEmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
}

// ─── Provider detection ────────────────────────────────────

/**
 * Returns true if any email provider (SMTP or SendGrid) is configured.
 * Use this to decide whether to show "email will be sent" UI cues.
 */
export async function isEmailConfigured(): Promise<boolean> {
  const [smtpHost, sendgridKey] = await Promise.all([
    getSetting('smtp_host'),
    getSetting('sendgrid_api_key'),
  ])
  return !!(smtpHost || sendgridKey)
}

/**
 * Get the "from" address for outgoing emails.
 * Falls back to a sensible default if not set.
 */
async function getFromEmail(): Promise<string> {
  const from = await getSetting('smtp_from_email')
  if (from) return from

  // Fall back to store email if set
  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({
      where: { id: STORE_ID },
      select: { email: true, name: true },
    })
    if (store?.email) return store.email
  } catch {
    // ignore
  }

  return 'no-reply@freshmart.local'
}

// ─── SMTP transport (lazy-loaded) ──────────────────────────

let cachedTransport: any = null
let cachedTransportKey: string = ''

async function getSmtpTransport() {
  const [host, port, user, pass, secure] = await Promise.all([
    getSetting('smtp_host'),
    getSetting('smtp_port'),
    getSetting('smtp_user'),
    getSetting('smtp_pass'),
    getSetting('smtp_secure'),
  ])

  if (!host || !user || !pass) return null

  // Cache key — if credentials change, rebuild the transport
  const cacheKey = `${host}:${port}:${user}:${secure || 'false'}`
  if (cachedTransport && cachedTransportKey === cacheKey) {
    return cachedTransport
  }

  try {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: secure === 'true' || secure === '1',
      auth: { user, pass },
    })
    cachedTransport = transport
    cachedTransportKey = cacheKey
    return transport
  } catch (err) {
    console.error('[email] Failed to create SMTP transport:', err)
    return null
  }
}

/**
 * Invalidate the cached transport. Called after settings are updated
 * so the next send picks up new credentials.
 */
export function invalidateEmailTransportCache(): void {
  cachedTransport = null
  cachedTransportKey = ''
}

// ─── SendGrid HTTP API ─────────────────────────────────────

async function sendViaSendGrid(
  options: SendEmailOptions,
  apiKey: string,
  fromEmail: string,
): Promise<EmailResult> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: fromEmail },
        subject: options.subject,
        content: [
          { type: 'text/plain', value: options.text || '' },
          ...(options.html ? [{ type: 'text/html', value: options.html }] : []),
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        sent: false,
        reason: 'sendgrid_error',
        error: `SendGrid API ${response.status}: ${errorText.slice(0, 200)}`,
      }
    }

    return { sent: true, reason: 'success' }
  } catch (err) {
    return {
      sent: false,
      reason: 'sendgrid_error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Main send function ────────────────────────────────────

/**
 * Send an email. If no provider is configured, this is a no-op.
 *
 * Provider priority: SMTP → SendGrid
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!options.to) {
    return { sent: false, reason: 'no_recipient' }
  }

  const fromEmail = await getFromEmail()

  // 1. Try SMTP first
  const transport = await getSmtpTransport()
  if (transport) {
    try {
      const info = await transport.sendMail({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html || undefined,
      })
      return { sent: true, reason: 'success', messageId: info.messageId }
    } catch (err) {
      console.error('[email] SMTP send failed:', err)
      // Fall through to SendGrid
    }
  }

  // 2. Try SendGrid
  const sendgridKey = await getSetting('sendgrid_api_key')
  if (sendgridKey) {
    return sendViaSendGrid(options, sendgridKey, fromEmail)
  }

  // 3. Not configured
  return { sent: false, reason: 'not_configured' }
}

// ─── Template helpers ──────────────────────────────────────

export interface NotificationTemplate {
  orderConfirmation: string
  orderPicking: string
  outForDelivery: string
  orderDelivered: string
  orderCancelled?: string
  storeClosed: string
}

const DEFAULT_TEMPLATES: Required<NotificationTemplate> = {
  orderConfirmation: 'Your order #{orderId} has been placed! Total: {total}. We will notify you when it is being picked.',
  orderPicking: "We're now picking your order #{orderId}. Sit tight — it will be ready soon.",
  outForDelivery: 'Your order #{orderId} is on its way! Driver: {driverName}. Estimated delivery: {eta}.',
  orderDelivered: 'Your order #{orderId} has been delivered. Thank you for shopping with us!',
  orderCancelled: 'Your order #{orderId} has been cancelled. Please contact us if you have questions.',
  storeClosed: "We're currently closed. See you soon!",
}

/**
 * Load notification templates from the Store record. Falls back to
 * defaults if missing or malformed.
 */
export async function getNotificationTemplates(): Promise<Required<NotificationTemplate>> {
  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({
      where: { id: STORE_ID },
      select: { notificationTemplate: true },
    })
    if (store?.notificationTemplate) {
      try {
        const parsed = JSON.parse(store.notificationTemplate)
        return { ...DEFAULT_TEMPLATES, ...parsed }
      } catch {
        // Malformed JSON — fall back to defaults
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_TEMPLATES
}

/**
 * Replace {placeholder} tokens in a template string with actual values.
 */
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

/**
 * Format an ETA Date as a friendly human-readable string.
 * Examples: "3:45 PM" or "Tomorrow 10:30 AM" or "Mon 15 Jan, 4:00 PM"
 */
export function formatEta(eta: Date | string | null | undefined): string {
  if (!eta) return 'TBD'
  const date = typeof eta === 'string' ? new Date(eta) : eta
  if (isNaN(date.getTime())) return 'TBD'

  const now = new Date()
  const isSameDay = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const time = date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })

  if (isSameDay) return time
  if (isTomorrow) return `Tomorrow ${time}`
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) + ` ${time}`
}

// ─── Order-specific email helpers ──────────────────────────

export interface OrderEmailContext {
  orderId: string
  customerName: string
  customerEmail: string
  total?: string
  // Prisma returns `string | null` for nullable String fields, so we accept
  // null here too. Internally we coalesce to '' / 'your driver' when filling
  // the template.
  driverName?: string | null
  eta?: Date | string | null
}

/**
 * Build the email subject + body for a given order status transition.
 * Returns null if no template applies (e.g. for terminal states we
 * don't email about, though currently we email on all transitions).
 */
export async function buildOrderStatusEmail(
  toStatus: string,
  ctx: OrderEmailContext,
): Promise<{ subject: string; text: string } | null> {
  const templates = await getNotificationTemplates()

  const vars: Record<string, string> = {
    orderId: ctx.orderId,
    customerName: ctx.customerName || 'Customer',
    total: ctx.total || '',
    driverName: ctx.driverName || 'your driver',
    eta: formatEta(ctx.eta),
  }

  let body: string | null = null
  let subject: string

  switch (toStatus) {
    case 'placed':
      body = fillTemplate(templates.orderConfirmation, vars)
      subject = `Order confirmed — #${ctx.orderId}`
      break
    case 'picking':
      body = fillTemplate(templates.orderPicking, vars)
      subject = `We're picking your order — #${ctx.orderId}`
      break
    case 'ready':
      // No template defined for "ready" — this is an internal state.
      // We skip the email; the customer will get one when out_for_delivery.
      return null
    case 'out_for_delivery':
      body = fillTemplate(templates.outForDelivery, vars)
      subject = `Your order is on the way — #${ctx.orderId}`
      break
    case 'delivered':
      body = fillTemplate(templates.orderDelivered, vars)
      subject = `Order delivered — #${ctx.orderId}`
      break
    case 'cancelled':
      body = fillTemplate(templates.orderCancelled, vars)
      subject = `Order cancelled — #${ctx.orderId}`
      break
    default:
      return null
  }

  return { subject, text: body }
}

/**
 * High-level helper: send an order status email to the customer.
 * Silently no-ops if email is not configured or if the customer
 * has no email address (guest orders without email).
 *
 * Always creates an in-app Notification row too (so the customer
 * sees the update in their notifications panel even if email is off).
 */
export async function sendOrderStatusEmail(
  toStatus: string,
  ctx: OrderEmailContext,
  options?: { createInAppNotification?: boolean; userId?: string },
): Promise<EmailResult & { inAppNotificationId?: string }> {
  const createInApp = options?.createInAppNotification !== false
  const userId = options?.userId

  // 1. Always create an in-app notification (if we have a userId)
  let inAppNotificationId: string | undefined
  if (createInApp && userId) {
    try {
      const prisma = await getPrisma()
      const built = await buildOrderStatusEmail(toStatus, ctx)
      if (built) {
        const notif = await prisma.notification.create({
          data: {
            userId,
            type: 'order_update',
            title: built.subject,
            message: built.text,
            link: `/order/${ctx.orderId}`,
          },
        })
        inAppNotificationId = notif.id
      }
    } catch (err) {
      console.error('[email] Failed to create in-app notification:', err)
    }
  }

  // 2. Send the actual email (no-op if not configured)
  if (!ctx.customerEmail) {
    return { sent: false, reason: 'no_recipient', inAppNotificationId }
  }

  const built = await buildOrderStatusEmail(toStatus, ctx)
  if (!built) {
    return { sent: false, reason: 'success', inAppNotificationId }
  }

  const result = await sendEmail({
    to: ctx.customerEmail,
    subject: built.subject,
    text: built.text,
  })

  return { ...result, inAppNotificationId }
}
