import { createBrowserClient } from '@supabase/ssr'

/**
 * Create a Supabase browser client for client-side auth and data.
 * Validates that required environment variables are set to prevent
 * cryptic "Failed to fetch" errors when deploying to Vercel.
 */
export function createClient() {
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

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
