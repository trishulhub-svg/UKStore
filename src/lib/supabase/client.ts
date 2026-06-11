import { createBrowserClient } from '@supabase/ssr'

/**
 * Singleton Supabase browser client for client-side auth and data.
 *
 * IMPORTANT: `createBrowserClient` must only be called ONCE per page load.
 * Multiple instances break real-time subscriptions, cause cookie race
 * conditions, and waste resources. This singleton pattern ensures a
 * single shared instance is reused across all components.
 *
 * Validates that required environment variables are set to prevent
 * cryptic "Failed to fetch" / "Load failed" errors on Vercel.
 */
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing: string[] = []
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Please add them in your Vercel project Settings → Environment Variables. ` +
      `See the deployment guide for the full list.`
    )
  }

  // Validate URL format to catch common misconfigurations
  if (!supabaseUrl.startsWith('https://')) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must start with "https://". ` +
      `Current value: "${supabaseUrl}". This will cause "Load failed" errors in the browser.`
    )
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return client
}
