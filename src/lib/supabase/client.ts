import { createBrowserClient } from '@supabase/ssr'

/**
 * Singleton Supabase browser client for client-side data operations.
 *
 * Auth is now handled by local auth (/lib/auth-client.ts).
 * This client is only used for data fetching (products, categories, etc.)
 * which already have fallbacks via the mock-data system.
 *
 * Returns null if Supabase is not configured, so callers can fall back
 * to mock data instead of crashing.
 */
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return null-like behavior: callers should check before using
    // We throw a soft error that can be caught
    console.warn('[Supabase] Environment variables not configured. Data operations will use fallback data.')
    return null as unknown as ReturnType<typeof createBrowserClient>
  }

  // Validate URL format to catch common misconfigurations
  if (!supabaseUrl.startsWith('https://')) {
    console.warn('[Supabase] URL must start with "https://". Data operations will use fallback data.')
    return null as unknown as ReturnType<typeof createBrowserClient>
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return client
}
