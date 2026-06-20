import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { autoExpireProducts } from '@/lib/product-expiry'

/**
 * POST /api/admin/wastage/auto-expire
 *
 * Scans the store's products for any whose `expiryDate` is in the past and
 * still has stock. For each, creates a WastageLog entry with reason='expired',
 * zeros the product's stockQuantity, and marks it unavailable.
 *
 * Idempotent: a product is only logged once per 24h window — see
 * lib/product-expiry.ts for the dedup logic.
 *
 * Body (optional):
 *   { dryRun?: boolean }  — if true, returns what *would* be logged without writing
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAdmin({ feature: 'wastage' })
  if (error) return error

  let dryRun = false
  try {
    const body = await request.json()
    if (body && typeof body.dryRun === 'boolean') dryRun = body.dryRun
  } catch {
    // Body may be empty — that's fine, dryRun stays false
  }

  try {
    const prisma = await getPrisma()
    const result = await autoExpireProducts(prisma, {
      actorUserId: user.id,
      dryRun,
    })

    return NextResponse.json({
      success: true,
      dryRun,
      ...result,
    })
  } catch (err) {
    console.error('[Auto-expire POST]', err)
    return NextResponse.json(
      { error: 'Failed to scan expired products' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/wastage/auto-expire
 *
 * Returns a dry-run preview of what *would* be auto-expired. Same as
 * POST with { dryRun: true } but uses GET so it can be fetched on page load.
 */
export async function GET() {
  const { error, user } = await requireAdmin({ feature: 'wastage' })
  if (error) return error

  try {
    const prisma = await getPrisma()
    const result = await autoExpireProducts(prisma, {
      actorUserId: user.id,
      dryRun: true,
    })

    return NextResponse.json({
      success: true,
      dryRun: true,
      ...result,
    })
  } catch (err) {
    console.error('[Auto-expire GET]', err)
    return NextResponse.json(
      { error: 'Failed to scan expired products' },
      { status: 500 }
    )
  }
}
