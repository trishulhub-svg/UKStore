/**
 * Product Expiry Utility
 *
 * Scans for products past their hard expiry date and converts them into
 * WastageLog entries. Each product is processed at most once — we check
 * for an existing wastage log with reason='expired' for that product in
 * the last 24 hours to avoid duplicates.
 *
 * Designed to be called from:
 *   - A cron-like trigger (not yet wired)
 *   - The /api/admin/wastage/auto-expire endpoint (manual trigger from UI)
 *   - The wastage page on load (so the admin sees the freshest state)
 */
import type { PrismaClient } from '@prisma/client'

const STORE_ID = 'store-fresh-mart-001'

export interface AutoExpireResult {
  scanned: number
  expired: number
  movedToWastage: number
  alreadyLogged: number
  outOfStock: number
  details: Array<{
    productId: string
    productName: string
    expiryDate: Date
    quantity: number
    skipped?: 'already_logged' | 'no_stock'
  }>
}

export async function autoExpireProducts(
  prisma: PrismaClient,
  options: { actorUserId?: string; dryRun?: boolean } = {}
): Promise<AutoExpireResult> {
  const now = new Date()
  const actor = options.actorUserId || 'system-auto-expire'
  const result: AutoExpireResult = {
    scanned: 0,
    expired: 0,
    movedToWastage: 0,
    alreadyLogged: 0,
    outOfStock: 0,
    details: [],
  }

  // Find all products in this store with a hard expiry date in the past
  // and that still have stock (stockQuantity > 0). We don't touch products
  // that already have zero stock — those were already disposed manually.
  const expiredProducts = await prisma.product.findMany({
    where: {
      storeId: STORE_ID,
      expiryDate: { lt: now, not: null },
      stockQuantity: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      expiryDate: true,
      stockQuantity: true,
    },
  })

  result.scanned = expiredProducts.length

  if (expiredProducts.length === 0) {
    return result
  }

  // Find which of these have already been logged as 'expired' in the last 24h
  // to avoid creating duplicate wastage entries on repeated calls.
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const recentExpiredLogs = await prisma.wastageLog.findMany({
    where: {
      reason: 'expired',
      createdAt: { gte: oneDayAgo },
      productId: { in: expiredProducts.map((p) => p.id) },
    },
    select: { productId: true },
  })
  const alreadyLoggedIds = new Set(recentExpiredLogs.map((l) => l.productId))

  for (const product of expiredProducts) {
    result.expired++
    if (alreadyLoggedIds.has(product.id)) {
      result.alreadyLogged++
      result.details.push({
        productId: product.id,
        productName: product.name,
        expiryDate: product.expiryDate!,
        quantity: product.stockQuantity,
        skipped: 'already_logged',
      })
      continue
    }
    if (product.stockQuantity <= 0) {
      result.outOfStock++
      result.details.push({
        productId: product.id,
        productName: product.name,
        expiryDate: product.expiryDate!,
        quantity: 0,
        skipped: 'no_stock',
      })
      continue
    }

    if (options.dryRun) {
      result.details.push({
        productId: product.id,
        productName: product.name,
        expiryDate: product.expiryDate!,
        quantity: product.stockQuantity,
      })
      continue
    }

    // Create the wastage log and zero out the stock atomically
    await prisma.$transaction([
      prisma.wastageLog.create({
        data: {
          productId: product.id,
          quantity: product.stockQuantity,
          reason: 'expired',
          notes: `Auto-logged: product expiry date ${product.expiryDate!.toISOString().split('T')[0]} passed.`,
          loggedBy: actor,
        },
      }),
      prisma.product.update({
        where: { id: product.id },
        data: {
          stockQuantity: 0,
          isAvailable: false,
        },
      }),
    ])

    result.movedToWastage++
    result.details.push({
      productId: product.id,
      productName: product.name,
      expiryDate: product.expiryDate!,
      quantity: product.stockQuantity,
    })
  }

  return result
}
