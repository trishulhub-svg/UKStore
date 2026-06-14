// ============================================================
// UK Grocery Store - Server-side Settings Utility
// Reads API keys from Prisma (SQLite) first, falls back to env vars
// Only accessible by owner/manager roles via API auth checks
// ============================================================

import { getPrisma } from '@/lib/auth/prisma'

const STORE_ID = 'store-fresh-mart-001'

// Cache settings in memory for 60 seconds to avoid repeated DB hits
interface CachedSettings {
  data: Record<string, string>
  timestamp: number
}

let settingsCache: CachedSettings | null = null
const CACHE_TTL = 60_000 // 60 seconds

/**
 * Fetch all settings from the database for the default store.
 * Results are cached for 60 seconds to reduce DB load.
 */
async function getSettingsFromDB(): Promise<Record<string, string>> {
  const now = Date.now()

  if (settingsCache && now - settingsCache.timestamp < CACHE_TTL) {
    return settingsCache.data
  }

  try {
    const prisma = await getPrisma()
    const settings = await prisma.storeSetting.findMany({
      where: { storeId: STORE_ID },
      select: { key: true, value: true },
    })

    const settingsMap: Record<string, string> = {}
    for (const row of settings) {
      if (row.value) {
        settingsMap[row.key] = row.value
      }
    }

    settingsCache = { data: settingsMap, timestamp: now }
    return settingsMap
  } catch (err) {
    console.warn('Settings DB fetch error:', err)
    return settingsCache?.data || {}
  }
}

/**
 * Get a single setting value.
 * Priority: 1) Database (owner-configured) → 2) Environment variable → 3) Default
 *
 * @param key - The setting key (e.g., 'stripe_secret_key')
 * @param envVarName - Optional environment variable name to check as fallback
 * @param defaultValue - Optional default value if nothing is found
 */
export async function getSetting(
  key: string,
  envVarName?: string,
  defaultValue?: string
): Promise<string | undefined> {
  // 1. Check database first (owner-configured value)
  const dbSettings = await getSettingsFromDB()
  if (dbSettings[key]) {
    return dbSettings[key]
  }

  // 2. Fall back to environment variable
  if (envVarName && process.env[envVarName]) {
    return process.env[envVarName]
  }

  // 3. Also check if key name matches a common env var pattern
  const envKey = key.toUpperCase().replace(/-/g, '_')
  if (process.env[envKey]) {
    return process.env[envKey]
  }

  // 4. Default value
  return defaultValue
}

/**
 * Get multiple settings at once.
 * Returns a key-value map with DB values taking priority over env vars.
 *
 * @param keys - Array of setting keys to fetch
 * @param envMapping - Optional mapping of setting key → env var name
 */
export async function getSettings(
  keys: string[],
  envMapping?: Record<string, string>
): Promise<Record<string, string | undefined>> {
  const dbSettings = await getSettingsFromDB()
  const result: Record<string, string | undefined> = {}

  for (const key of keys) {
    // DB first
    if (dbSettings[key]) {
      result[key] = dbSettings[key]
      continue
    }

    // Env var fallback (explicit mapping)
    const envName = envMapping?.[key]
    if (envName && process.env[envName]) {
      result[key] = process.env[envName]
      continue
    }

    // Env var fallback (auto-mapping)
    const envKey = key.toUpperCase().replace(/-/g, '_')
    if (process.env[envKey]) {
      result[key] = process.env[envKey]
      continue
    }

    result[key] = undefined
  }

  return result
}

/**
 * Get Stripe configuration from DB/env.
 * Convenience method for the checkout flow.
 */
export async function getStripeConfig(): Promise<{
  publishableKey: string | undefined
  secretKey: string | undefined
  webhookSecret: string | undefined
  isConfigured: boolean
}> {
  const settings = await getSettings(
    ['stripe_publishable_key', 'stripe_secret_key', 'stripe_webhook_secret'],
    {
      stripe_publishable_key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      stripe_secret_key: 'STRIPE_SECRET_KEY',
      stripe_webhook_secret: 'STRIPE_WEBHOOK_SECRET',
    }
  )

  return {
    publishableKey: settings.stripe_publishable_key,
    secretKey: settings.stripe_secret_key,
    webhookSecret: settings.stripe_webhook_secret,
    isConfigured: !!(settings.stripe_publishable_key && settings.stripe_secret_key),
  }
}

/**
 * Invalidate the settings cache.
 * Call this after updating settings so the next read gets fresh data.
 */
export function invalidateSettingsCache(): void {
  settingsCache = null
}
