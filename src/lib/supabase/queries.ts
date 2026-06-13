import { createServiceClient } from '@/lib/supabase/server'
import type { Store, Category, ProductWithCategory } from '@/types'
import { mockData } from './mock-data'

// Cache whether Supabase is reachable to avoid repeated timeouts
let supabaseReachable: boolean | null = null
let lastCheckTime = 0
const CHECK_INTERVAL = 60_000 // Re-check every 60 seconds

async function isSupabaseReachable(): Promise<boolean> {
  const now = Date.now()
  if (supabaseReachable !== null && now - lastCheckTime < CHECK_INTERVAL) {
    return supabaseReachable
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      supabaseReachable = false
      lastCheckTime = now
      return false
    }
    const response = await fetch(`${url}/rest/v1/`, {
      signal: controller.signal,
      headers: {
        apikey: key,
      },
    })
    clearTimeout(timeoutId)
    supabaseReachable = response.ok || response.status === 401 // 401 means server is reachable
    lastCheckTime = now
    return supabaseReachable
  } catch {
    supabaseReachable = false
    lastCheckTime = now
    return false
  }
}

/**
 * Helper to try Supabase query and fall back to mock data
 */
async function withFallback<T>(fetcher: () => Promise<T>, fallback: T): Promise<T> {
  const reachable = await isSupabaseReachable()
  if (!reachable) return fallback

  try {
    return await fetcher()
  } catch {
    return fallback
  }
}

/**
 * Get store by ID
 */
export async function getStore(storeId: string): Promise<Store | null> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.store

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()

    if (error || !data) return null
    return data as Store
  }, mockData.store)
}

/**
 * Get the first active store (for single-store MVP)
 */
export async function getDefaultStore(): Promise<Store | null> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.store

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (error || !data) return null
    return data as Store
  }, mockData.store)
}

/**
 * Get all active categories for a store, ordered by sort_order
 */
export async function getCategories(storeId: string): Promise<Category[]> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.categories

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error || !data) return []
    return data as Category[]
  }, mockData.categories)
}

/**
 * Get all available products for a store, with category relation
 */
export async function getProducts(storeId: string): Promise<ProductWithCategory[]> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.products

    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })

    if (error || !data) return []
    return data as ProductWithCategory[]
  }, mockData.products)
}

/**
 * Get products filtered by category
 */
export async function getProductsByCategory(storeId: string, categoryId: string): Promise<ProductWithCategory[]> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.products.filter((p) => p.category_id === categoryId)

    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('category_id', categoryId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })

    if (error || !data) return []
    return data as ProductWithCategory[]
  }, mockData.products.filter((p) => p.category_id === categoryId))
}

/**
 * Get featured products only (is_featured = true)
 */
export async function getFeaturedProducts(storeId: string): Promise<ProductWithCategory[]> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.products.filter((p) => p.is_featured)

    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('is_available', true)
      .eq('is_featured', true)
      .order('sort_order', { ascending: true })

    if (error || !data) return []
    return data as ProductWithCategory[]
  }, mockData.products.filter((p) => p.is_featured))
}

/**
 * Get single product by slug
 */
export async function getProductBySlug(storeId: string, slug: string): Promise<ProductWithCategory | null> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.products.find((p) => p.slug === slug) || null

    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('slug', slug)
      .single()

    if (error || !data) return null
    return data as ProductWithCategory
  }, mockData.products.find((p) => p.slug === slug) || null)
}

/**
 * Text search using ilike on name
 */
export async function searchProducts(storeId: string, query: string): Promise<ProductWithCategory[]> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('is_available', true)
      .ilike('name', `%${query}%`)
      .order('sort_order', { ascending: true })

    if (error || !data) return []
    return data as ProductWithCategory[]
  }, mockData.products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())))
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(storeId: string, slug: string): Promise<Category | null> {
  return withFallback(async () => {
    const supabase = createServiceClient()
    if (!supabase) return mockData.categories.find((c) => c.slug === slug) || null

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !data) return null
    return data as Category
  }, mockData.categories.find((c) => c.slug === slug) || null)
}
