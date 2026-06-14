import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
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
        endpoint: endpoint || '/api/admin/settings',
      },
    },
    { status }
  )
}

/**
 * GET /api/admin/settings
 * Fetch all settings for the store (owner only)
 */
export async function GET() {
  const endpoint = '/api/admin/settings'
  try {
    const user = await getServerUser()

    if (!user) {
      return buildApiError(
        'Authentication required. Please log in.',
        'AUTH_REQUIRED',
        401,
        'No valid session cookie was found.',
        endpoint,
      )
    }

    if (user.role !== 'owner' && user.role !== 'OWNER') {
      return buildApiError(
        'Only store owners can access settings.',
        'FORBIDDEN_ROLE',
        403,
        `Current user role: "${user.role}". Required role: "owner". User: ${user.email} (ID: ${user.id})`,
        endpoint,
      )
    }

    // Fetch settings from Supabase
    try {
      const supabase = getSupabaseAdmin()
      const { data: settings, error: dbError } = await supabase
        .from('store_settings')
        .select('*')
        .eq('store_id', STORE_ID)

      if (dbError) {
        console.error('[Admin Settings GET] Supabase error:', dbError)
      } else {
        // Map to frontend snake_case format
        const mappedSettings = (settings || []).map((s: any) => ({
          id: s.id,
          store_id: s.store_id,
          key: s.key,
          value: s.value,
          is_secret: s.is_secret,
          category: s.category,
          description: s.description,
          created_at: s.created_at,
          updated_at: s.updated_at,
        }))

        return NextResponse.json({ settings: mappedSettings })
      }
    } catch (err) {
      console.error('[Admin Settings GET] Supabase error:', err)
    }

    // Fallback: return empty settings
    return NextResponse.json({ settings: [] })
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack || '' : ''
    return buildApiError(
      'An internal server error occurred while fetching settings.',
      'INTERNAL_ERROR',
      500,
      `Error: ${errMessage}\n${errStack}`,
      endpoint,
    )
  }
}

/**
 * PUT /api/admin/settings
 * Update multiple settings at once (owner only)
 * Body: { settings: [{ key: string, value: string }] }
 */
export async function PUT(request: NextRequest) {
  const endpoint = '/api/admin/settings'
  try {
    const user = await getServerUser()

    if (!user) {
      return buildApiError(
        'Authentication required. Please log in.',
        'AUTH_REQUIRED',
        401,
        'No valid session cookie was found.',
        endpoint,
      )
    }

    if (user.role !== 'owner' && user.role !== 'OWNER') {
      return buildApiError(
        'Only store owners can modify settings.',
        'FORBIDDEN_ROLE',
        403,
        `Current user role: "${user.role}". Required role: "owner". User: ${user.email} (ID: ${user.id})`,
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
        'The server could not parse the request body as JSON.',
        endpoint,
      )
    }

    const { settings } = body as {
      settings: Array<{ key: string; value: string }>
    }

    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return buildApiError(
        'No settings provided.',
        'MISSING_SETTINGS',
        400,
        `Received settings value: ${JSON.stringify(settings)}`,
        endpoint,
      )
    }

    // Validate all keys are in the whitelist
    for (const item of settings) {
      if (!VALID_KEYS.has(item.key)) {
        return buildApiError(
          `Invalid setting key: ${item.key}`,
          'INVALID_SETTING_KEY',
          400,
          `Key "${item.key}" is not in the allowed list. Valid keys: ${[...VALID_KEYS].join(', ')}`,
          endpoint,
        )
      }
    }

    // Update settings in Supabase using upsert
    try {
      const supabase = getSupabaseAdmin()
      const results: Array<{ key: string; success: boolean }> = []

      for (const item of settings) {
        try {
          // Determine category and is_secret from the SETTING_DEFINITIONS
          const categoryMap: Record<string, string> = {
            stripe_publishable_key: 'integrations',
            stripe_secret_key: 'integrations',
            stripe_webhook_secret: 'integrations',
            google_oauth_client_id: 'integrations',
            google_oauth_client_secret: 'integrations',
            sendgrid_api_key: 'notifications',
            taxjar_api_key: 'integrations',
          }
          const secretKeys = new Set([
            'stripe_secret_key',
            'stripe_webhook_secret',
            'google_oauth_client_secret',
            'sendgrid_api_key',
            'taxjar_api_key',
          ])

          const category = (categoryMap[item.key] || 'general') as 'integrations' | 'delivery' | 'notifications' | 'general'
          const isSecret = secretKeys.has(item.key)

          // Check if setting exists, then upsert
          const { data: existing, error: fetchError } = await supabase
            .from('store_settings')
            .select('id')
            .eq('store_id', STORE_ID)
            .eq('key', item.key)
            .maybeSingle()

          if (fetchError) {
            console.error(`Failed to check setting ${item.key}:`, fetchError)
            results.push({ key: item.key, success: false })
            continue
          }

          if (existing) {
            // Update existing
            const { error: updateError } = await supabase
              .from('store_settings')
              .update({ value: item.value })
              .eq('id', (existing as any).id)

            if (updateError) {
              console.error(`Failed to update setting ${item.key}:`, updateError)
              results.push({ key: item.key, success: false })
              continue
            }
          } else {
            // Insert new
            const { error: insertError } = await supabase
              .from('store_settings')
              .insert({
                store_id: STORE_ID,
                key: item.key,
                value: item.value,
                is_secret: isSecret,
                category,
              })

            if (insertError) {
              console.error(`Failed to insert setting ${item.key}:`, insertError)
              results.push({ key: item.key, success: false })
              continue
            }
          }

          results.push({ key: item.key, success: true })
        } catch (err) {
          console.error(`Failed to update setting ${item.key}:`, err)
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
    } catch (err) {
      console.error('[Admin Settings PUT] Supabase error:', err)
    }

    // No database available - settings cannot be persisted
    return NextResponse.json({
      success: false,
      results: settings.map((s) => ({ key: s.key, success: false })),
      message: 'Database not available. Settings cannot be saved without a database connection.',
    })
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack || '' : ''
    return buildApiError(
      'An internal server error occurred while updating settings.',
      'INTERNAL_ERROR',
      500,
      `Error: ${errMessage}\n${errStack}`,
      endpoint,
    )
  }
}

/**
 * PATCH /api/admin/settings
 * Update store information (owner only)
 * Body: { store: { name, address, phone, email, base_delivery_fee, per_km_charge, free_delivery_threshold, delivery_radius_km, is_active } }
 */
export async function PATCH(request: NextRequest) {
  const endpoint = '/api/admin/settings'
  try {
    const user = await getServerUser()

    if (!user) {
      return buildApiError(
        'Authentication required. Please log in.',
        'AUTH_REQUIRED',
        401,
        'No valid session cookie was found.',
        endpoint,
      )
    }

    if (user.role !== 'owner' && user.role !== 'OWNER') {
      return buildApiError(
        'Only store owners can modify store settings.',
        'FORBIDDEN_ROLE',
        403,
        `Current user role: "${user.role}". Required role: "owner". User: ${user.email} (ID: ${user.id})`,
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
        'The server could not parse the request body as JSON.',
        endpoint,
      )
    }

    const { store } = body as {
      store: Record<string, any>
    }

    if (!store || typeof store !== 'object') {
      return buildApiError(
        'No store data provided.',
        'MISSING_STORE',
        400,
        'Expected a "store" object in the request body.',
        endpoint,
      )
    }

    // Whitelist of allowed store fields for update
    const allowedFields = new Set([
      'name',
      'address',
      'phone',
      'email',
      'base_delivery_fee',
      'per_km_charge',
      'free_delivery_threshold',
      'delivery_radius_km',
      'is_active',
    ])

    const updates: Record<string, any> = {}
    for (const [key, value] of Object.entries(store)) {
      if (allowedFields.has(key)) {
        updates[key] = value
      }
    }

    if (Object.keys(updates).length === 0) {
      return buildApiError(
        'No valid store fields provided for update.',
        'NO_FIELDS',
        400,
        `Allowed fields: ${[...allowedFields].join(', ')}`,
        endpoint,
      )
    }

    // Update the stores table
    try {
      const supabase = getSupabaseAdmin()
      const { data, error: updateError } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', STORE_ID)
        .select()
        .single()

      if (updateError) {
        console.error('[Admin Settings PATCH] Supabase error:', updateError)
        return buildApiError(
          'Failed to update store information.',
          'DB_ERROR',
          500,
          `Supabase error: ${updateError.message}`,
          endpoint,
        )
      }

      return NextResponse.json({
        success: true,
        store: data,
        message: 'Store information updated successfully',
      })
    } catch (err) {
      console.error('[Admin Settings PATCH] Supabase error:', err)
      return buildApiError(
        'Failed to update store information.',
        'DB_ERROR',
        500,
        `Error: ${err instanceof Error ? err.message : String(err)}`,
        endpoint,
      )
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack || '' : ''
    return buildApiError(
      'An internal server error occurred while updating store information.',
      'INTERNAL_ERROR',
      500,
      `Error: ${errMessage}\n${errStack}`,
      endpoint,
    )
  }
}
