import { getPrisma } from '@/lib/auth/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import type { Store, Category, ProductWithCategory } from '@/types'
import { mockData } from './mock-data'

// ─── Mappers: Prisma camelCase → Frontend snake_case ──────────

function mapPrismaStoreToStore(s: any): Store {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    phone: s.phone,
    email: s.email,
    base_delivery_fee: s.baseDeliveryFee,
    per_km_charge: s.perKmCharge,
    free_delivery_threshold: s.freeDeliveryThreshold,
    delivery_radius_km: s.deliveryRadiusKm,
    is_active: s.isActive,
    created_at: s.createdAt?.toISOString?.() ?? s.created_at ?? '',
    updated_at: s.updatedAt?.toISOString?.() ?? s.updated_at ?? '',
  }
}

function mapPrismaCategoryToCategory(c: any): Category {
  return {
    id: c.id,
    store_id: c.storeId,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image_url: c.imageUrl,
    parent_id: c.parentId,
    sort_order: c.sortOrder,
    is_active: c.isActive,
    created_at: c.createdAt?.toISOString?.() ?? c.created_at ?? '',
  }
}

function mapPrismaProductToProductWithCategory(p: any): ProductWithCategory {
  return {
    id: p.id,
    store_id: p.storeId,
    category_id: p.categoryId,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    vat_rate: p.vatRate,
    is_hfss: p.isHfss,
    image_url: p.imageUrl,
    barcode: p.barcode,
    unit: p.unit,
    weight_kg: p.weightKg,
    is_available: p.isAvailable,
    stock_quantity: p.stockQuantity,
    is_featured: p.isFeatured,
    sort_order: p.sortOrder,
    created_at: p.createdAt?.toISOString?.() ?? p.created_at ?? '',
    updated_at: p.updatedAt?.toISOString?.() ?? p.updated_at ?? '',
    category: p.category ? mapPrismaCategoryToCategory(p.category) : ({} as Category),
  }
}

// ─── Supabase reachability cache ──────────────────────────────

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
 * Try Supabase query — returns null if Supabase is not available or query fails
 */
async function trySupabase<T>(fetcher: () => Promise<T>): Promise<T | null> {
  const reachable = await isSupabaseReachable()
  if (!reachable) return null

  try {
    return await fetcher()
  } catch {
    return null
  }
}

// ─── Query functions ──────────────────────────────────────────
// Pattern: 1. Try Prisma → 2. Try Supabase → 3. Mock data fallback

/**
 * Get store by ID
 */
export async function getStore(storeId: string): Promise<Store | null> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({ where: { id: storeId } })
    if (store) return mapPrismaStoreToStore(store)
  } catch (err) {
    console.warn('[queries] Prisma getStore failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single()
    if (error || !data) return null
    return data as Store
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.store
}

/**
 * Get the first active store (for single-store MVP)
 */
export async function getDefaultStore(): Promise<Store | null> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findFirst({
      where: { isActive: true },
    })
    if (store) return mapPrismaStoreToStore(store)
  } catch (err) {
    console.warn('[queries] Prisma getDefaultStore failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()
    if (error || !data) return null
    return data as Store
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.store
}

/**
 * Get all active categories for a store, ordered by sort_order
 */
export async function getCategories(storeId: string): Promise<Category[]> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const categories = await prisma.category.findMany({
      where: { storeId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (categories.length > 0) return categories.map(mapPrismaCategoryToCategory)
  } catch (err) {
    console.warn('[queries] Prisma getCategories failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (error || !data) return null
    return data as Category[]
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.categories
}

/**
 * Get all available products for a store, with category relation
 */
export async function getProducts(storeId: string): Promise<ProductWithCategory[]> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const products = await prisma.product.findMany({
      where: { storeId, isAvailable: true },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (products.length > 0) return products.map(mapPrismaProductToProductWithCategory)
  } catch (err) {
    console.warn('[queries] Prisma getProducts failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
    if (error || !data) return null
    return data as ProductWithCategory[]
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.products
}

/**
 * Get products filtered by category
 */
export async function getProductsByCategory(storeId: string, categoryId: string): Promise<ProductWithCategory[]> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const products = await prisma.product.findMany({
      where: { storeId, categoryId, isAvailable: true },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (products.length > 0) return products.map(mapPrismaProductToProductWithCategory)
  } catch (err) {
    console.warn('[queries] Prisma getProductsByCategory failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('category_id', categoryId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
    if (error || !data) return null
    return data as ProductWithCategory[]
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.products.filter((p) => p.category_id === categoryId)
}

/**
 * Get featured products only (is_featured = true)
 */
export async function getFeaturedProducts(storeId: string): Promise<ProductWithCategory[]> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const products = await prisma.product.findMany({
      where: { storeId, isAvailable: true, isFeatured: true },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (products.length > 0) return products.map(mapPrismaProductToProductWithCategory)
  } catch (err) {
    console.warn('[queries] Prisma getFeaturedProducts failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('is_available', true)
      .eq('is_featured', true)
      .order('sort_order', { ascending: true })
    if (error || !data) return null
    return data as ProductWithCategory[]
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.products.filter((p) => p.is_featured)
}

/**
 * Get single product by slug
 */
export async function getProductBySlug(storeId: string, slug: string): Promise<ProductWithCategory | null> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const product = await prisma.product.findFirst({
      where: { storeId, slug },
      include: { category: true },
    })
    if (product) return mapPrismaProductToProductWithCategory(product)
  } catch (err) {
    console.warn('[queries] Prisma getProductBySlug failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('slug', slug)
      .single()
    if (error || !data) return null
    return data as ProductWithCategory
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.products.find((p) => p.slug === slug) || null
}

/**
 * Text search using contains on name
 */
export async function searchProducts(storeId: string, query: string): Promise<ProductWithCategory[]> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const products = await prisma.product.findMany({
      where: {
        storeId,
        isAvailable: true,
        name: { contains: query },
      },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (products.length > 0) return products.map(mapPrismaProductToProductWithCategory)
  } catch (err) {
    console.warn('[queries] Prisma searchProducts failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('store_id', storeId)
      .eq('is_available', true)
      .ilike('name', `%${query}%`)
      .order('sort_order', { ascending: true })
    if (error || !data) return null
    return data as ProductWithCategory[]
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(storeId: string, slug: string): Promise<Category | null> {
  // 1. Try Prisma
  try {
    const prisma = await getPrisma()
    const category = await prisma.category.findFirst({
      where: { storeId, slug, isActive: true },
    })
    if (category) return mapPrismaCategoryToCategory(category)
  } catch (err) {
    console.warn('[queries] Prisma getCategoryBySlug failed, trying fallback:', err)
  }

  // 2. Try Supabase
  const supabaseResult = await trySupabase(async () => {
    const supabase = createServiceClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', storeId)
      .eq('slug', slug)
      .eq('is_active', true)
      .single()
    if (error || !data) return null
    return data as Category
  })
  if (supabaseResult) return supabaseResult

  // 3. Mock data fallback
  return mockData.categories.find((c) => c.slug === slug) || null
}
