import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { createServiceClient } from '@/lib/supabase/server'
import { invalidateSettingsCache } from '@/lib/settings'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

// Valid setting keys (whitelist — only these can be set)
const VALID_KEYS = new Set([
  'stripe_publishable_key',
  'stripe_secret_key',
  'stripe_webhook_secret',
  'google_oauth_client_id',
  'google_oauth_client_secret',
  'sendgrid_api_key',
  'taxjar_api_key',
])

/**
 * GET /api/admin/settings
 * Fetch all settings for the store (owner only)
 */
export async function GET() {
  try {
    const user = await getServerUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Only store owners can access settings' }, { status: 403 })
    }

    // Try to fetch settings from Supabase
    const serviceClient = createServiceClient()
    if (serviceClient) {
      try {
        const { data: settings, error } = await serviceClient
          .from('store_settings')
          .select('*')
          .eq('store_id', STORE_ID)

        if (!error && settings) {
          return NextResponse.json({ settings })
        }
      } catch {
        // Continue to return empty settings
      }
    }

    // Fallback: return empty settings
    return NextResponse.json({ settings: [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/settings
 * Update multiple settings at once (owner only)
 * Body: { settings: [{ key: string, value: string, last_updated_by: string }] }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getServerUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Only store owners can modify settings' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body as {
      settings: Array<{ key: string; value: string; last_updated_by: string }>
    }

    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 })
    }

    // Validate all keys are in the whitelist
    for (const item of settings) {
      if (!VALID_KEYS.has(item.key)) {
        return NextResponse.json(
          { error: `Invalid setting key: ${item.key}` },
          { status: 400 }
        )
      }
    }

    // Try to update settings in Supabase
    const serviceClient = createServiceClient()
    if (serviceClient) {
      const results: Array<{ key: string; success: boolean }> = []

      for (const item of settings) {
        try {
          const { error } = await serviceClient
            .from('store_settings')
            .update({
              value: item.value,
              last_updated_by: user.id,
            })
            .eq('store_id', STORE_ID)
            .eq('key', item.key)

          results.push({
            key: item.key,
            success: !error,
          })

          if (error) {
            console.error(`Failed to update setting ${item.key}:`, error.message)
          }
        } catch {
          results.push({ key: item.key, success: false })
        }
      }

      // Invalidate the settings cache so the next read gets fresh data
      invalidateSettingsCache()

      const allSuccess = results.every((r) => r.success)
      return NextResponse.json({
        success: allSuccess,
        results,
        message: allSuccess
          ? `Updated ${results.length} setting(s) successfully`
          : 'Some settings failed to update',
      })
    }

    // No Supabase available - settings cannot be persisted
    return NextResponse.json({
      success: false,
      results: settings.map((s) => ({ key: s.key, success: false })),
      message: 'Database not available. Settings cannot be saved without a database connection.',
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
