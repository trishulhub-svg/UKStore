import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase browser client for client-side data operations.
 * Uses the anon key for public data with RLS protection.
 * Auth state is managed by Supabase Auth cookies.
 */
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[Supabase] Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
    )
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return client
}
