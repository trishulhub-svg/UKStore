import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// Valid fields that can be updated on the Store model
const EDITABLE_FIELDS = new Set([
  'name',
  'address',
  'latitude',
  'longitude',
  'phone',
  'email',
  'logoUrl',
  'defaultBanner1Url',
  'defaultBanner2Url',
])

/**
 * GET /api/admin/store/profile — Get store profile (owner only)
 */
export async function GET() {
  try {
    const user = await getServerUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (user.role !== 'owner' && user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only store owners can access store profile' }, { status: 403 })
    }

    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({
      where: { id: STORE_ID },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    return NextResponse.json({
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        address: store.address,
        latitude: store.latitude,
        longitude: store.longitude,
        phone: store.phone,
        email: store.email,
        logoUrl: store.logoUrl,
        defaultBanner1Url: store.defaultBanner1Url,
        defaultBanner2Url: store.defaultBanner2Url,
        isActive: store.isActive,
        isOpen: store.isOpen,
        baseDeliveryFee: store.baseDeliveryFee,
        perKmCharge: store.perKmCharge,
        freeDeliveryThreshold: store.freeDeliveryThreshold,
        deliveryRadiusKm: store.deliveryRadiusKm,
        openingHours: store.openingHours,
      },
    })
  } catch (err) {
    console.error('[Admin Store Profile GET]', err)
    return NextResponse.json({ error: 'Failed to fetch store profile' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/store/profile — Update store profile (owner only)
 * Body: { name?, address?, latitude?, longitude?, phone?, email? }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getServerUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (user.role !== 'owner' && user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only store owners can modify store profile' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Build update object with only allowed fields.
    // NOTE: `latitude` and `longitude` are NOT NULL in the schema. If the client
    // sends null/empty/undefined for them, we SKIP the field entirely (treat as
    // "don't update") rather than letting Prisma throw a NOT NULL constraint
    // violation, which previously surfaced as a generic 500 error.
    const updateData: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(body)) {
      if (!EDITABLE_FIELDS.has(key)) {
        return NextResponse.json({ error: `Invalid field: ${key}` }, { status: 400 })
      }

      // Validate specific fields
      if (key === 'name') {
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          return NextResponse.json({ error: 'Store name cannot be empty' }, { status: 400 })
        }
        updateData[key] = value.trim()
        continue
      }

      if (key === 'address' && typeof value !== 'string') {
        return NextResponse.json({ error: 'Address must be a string' }, { status: 400 })
      }

      if (key === 'latitude' || key === 'longitude') {
        // Skip null / undefined / empty string → treat as "no change".
        // This prevents the NOT NULL constraint violation that previously
        // caused the 500 "Failed to update store profile" error when the
        // user cleared the lat/lng input field.
        if (value === null || value === undefined || value === '') {
          continue
        }
        const num = Number(value)
        if (isNaN(num)) {
          return NextResponse.json(
            { error: `${key === 'latitude' ? 'Latitude' : 'Longitude'} must be a valid number` },
            { status: 400 }
          )
        }
        if (key === 'latitude' && (num < -90 || num > 90)) {
          return NextResponse.json({ error: 'Latitude must be between -90 and 90' }, { status: 400 })
        }
        if (key === 'longitude' && (num < -180 || num > 180)) {
          return NextResponse.json({ error: 'Longitude must be between -180 and 180' }, { status: 400 })
        }
        updateData[key] = num
        continue
      }

      if (key === 'phone' && value !== null && typeof value !== 'string') {
        return NextResponse.json({ error: 'Phone must be a string' }, { status: 400 })
      }

      if (key === 'email' && value !== null && typeof value !== 'string') {
        return NextResponse.json({ error: 'Email must be a string' }, { status: 400 })
      }

      if (key === 'logoUrl' && value !== null && typeof value !== 'string') {
        return NextResponse.json({ error: 'Logo URL must be a string' }, { status: 400 })
      }

      if (
        (key === 'defaultBanner1Url' || key === 'defaultBanner2Url') &&
        value !== null &&
        typeof value !== 'string'
      ) {
        return NextResponse.json({ error: `${key} must be a string` }, { status: 400 })
      }

      updateData[key] = value
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const prisma = await getPrisma()
    const updated = await prisma.store.update({
      where: { id: STORE_ID },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      store: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        address: updated.address,
        latitude: updated.latitude,
        longitude: updated.longitude,
        phone: updated.phone,
        email: updated.email,
        logoUrl: updated.logoUrl,
        defaultBanner1Url: updated.defaultBanner1Url,
        defaultBanner2Url: updated.defaultBanner2Url,
      },
      message: 'Store profile updated successfully',
    })
  } catch (err) {
    // Log the FULL error server-side so we can actually debug it.
    // Previously this only logged a generic label which made 500s
    // impossible to diagnose.
    const errMsg = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : undefined
    console.error('[Admin Store Profile PUT] Error:', errMsg, errStack)

    // In dev, surface the actual error so the admin/developer can see what
    // went wrong instead of the generic "Failed to update store profile".
    const isDev = process.env.NODE_ENV !== 'production'
    return NextResponse.json(
      {
        error: 'Failed to update store profile',
        ...(isDev ? { details: errMsg } : {}),
      },
      { status: 500 }
    )
  }
}
