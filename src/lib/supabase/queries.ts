import { createServiceClient } from '@/lib/supabase/server'
import type { Store, Category, ProductWithCategory } from '@/types'

// ============================================================
// Data Queries — Supabase Only
// All data is fetched from Supabase PostgreSQL.
// No Prisma fallback, no mock data fallback.
// ============================================================

// ─── Store Queries ──────────────────────────────────────────

/**
 * Get store by ID
 */
export async function getStore(storeId: string): Promise<Store | null> {
  const supabase = createServiceClient()
  if (!supabase) {
    console.error('[queries] Supabase service client not available')
    return null
  }

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single()

  if (error || !data) {
    console.warn('[queries] getStore error:', error?.message)
    return null
  }

  return data as Store
}

/**
 * Get the first active store (for single-store MVP)
 */
export async function getDefaultStore(): Promise<Store | null> {
  const supabase = createServiceClient()
  if (!supabase) {
    console.error('[queries] Supabase service client not available')
    return null
  }

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (error || !data) {
    console.warn('[queries] getDefaultStore error:', error?.message)
    return null
  }

  return data as Store
}

// ─── Category Queries ───────────────────────────────────────

/**
 * Get all active categories for a store, ordered by sort_order
 */
export async function getCategories(storeId: string): Promise<Category[]> {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    console.warn('[queries] getCategories error:', error?.message)
    return []
  }

  return data as Category[]
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(storeId: string, slug: string): Promise<Category | null> {
  const supabase = createServiceClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', storeId)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    console.warn('[queries] getCategoryBySlug error:', error?.message)
    return null
  }

  return data as Category
}

// ─── Product Queries ────────────────────────────────────────

/**
 * Get all available products for a store, with category relation
 */
export async function getProducts(storeId: string): Promise<ProductWithCategory[]> {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('store_id', storeId)
    .eq('is_available', true)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    console.warn('[queries] getProducts error:', error?.message)
    return []
  }

  return data as ProductWithCategory[]
}

/**
 * Get products filtered by category
 */
export async function getProductsByCategory(storeId: string, categoryId: string): Promise<ProductWithCategory[]> {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('store_id', storeId)
    .eq('category_id', categoryId)
    .eq('is_available', true)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    console.warn('[queries] getProductsByCategory error:', error?.message)
    return []
  }

  return data as ProductWithCategory[]
}

/**
 * Get featured products only
 */
export async function getFeaturedProducts(storeId: string): Promise<ProductWithCategory[]> {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('store_id', storeId)
    .eq('is_available', true)
    .eq('is_featured', true)
    .order('sort_order', { ascending: true })

  if (error || !data) {
    console.warn('[queries] getFeaturedProducts error:', error?.message)
    return []
  }

  return data as ProductWithCategory[]
}

/**
 * Get single product by slug
 */
export async function getProductBySlug(storeId: string, slug: string): Promise<ProductWithCategory | null> {
  const supabase = createServiceClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('store_id', storeId)
    .eq('slug', slug)
    .single()

  if (error || !data) {
    console.warn('[queries] getProductBySlug error:', error?.message)
    return null
  }

  return data as ProductWithCategory
}

/**
 * Get product by ID
 */
export async function getProductById(productId: string): Promise<ProductWithCategory | null> {
  const supabase = createServiceClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('id', productId)
    .single()

  if (error || !data) {
    console.warn('[queries] getProductById error:', error?.message)
    return null
  }

  return data as ProductWithCategory
}

/**
 * Get multiple products by IDs (for cart/order display)
 */
export async function getProductsByIds(productIds: string[]): Promise<ProductWithCategory[]> {
  if (productIds.length === 0) return []

  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .in('id', productIds)

  if (error || !data) {
    console.warn('[queries] getProductsByIds error:', error?.message)
    return []
  }

  return data as ProductWithCategory[]
}

/**
 * Text search using ilike on name (uses pg_trgm index if available)
 */
export async function searchProducts(storeId: string, query: string): Promise<ProductWithCategory[]> {
  if (!query || query.trim().length === 0) return []

  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('store_id', storeId)
    .eq('is_available', true)
    .ilike('name', `%${query}%`)
    .order('sort_order', { ascending: true })
    .limit(50)

  if (error || !data) {
    console.warn('[queries] searchProducts error:', error?.message)
    return []
  }

  return data as ProductWithCategory[]
}

// ─── User Profile Queries ───────────────────────────────────

/**
 * Get user profile by ID
 */
export async function getProfile(userId: string) {
  const supabase = createServiceClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) {
    console.warn('[queries] getProfile error:', error?.message)
    return null
  }

  return data
}

// ─── Address Queries ────────────────────────────────────────

/**
 * Get all addresses for a user
 */
export async function getAddresses(userId: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })

  if (error || !data) {
    console.warn('[queries] getAddresses error:', error?.message)
    return []
  }

  return data
}

// ─── Favourites Queries ─────────────────────────────────────

/**
 * Get favourite products for a user
 */
export async function getFavourites(userId: string): Promise<ProductWithCategory[]> {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('favourites')
    .select('product_id, products(*, category:categories(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.warn('[queries] getFavourites error:', error?.message)
    return []
  }

  // Extract products from the join
  return data
    .map((f: any) => f.products)
    .filter(Boolean) as ProductWithCategory[]
}

/**
 * Check if a product is in user's favourites
 */
export async function isFavourite(userId: string, productId: string): Promise<boolean> {
  const supabase = createServiceClient()
  if (!supabase) return false

  const { data, error } = await supabase
    .from('favourites')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single()

  return !error && !!data
}

// ─── Order Queries ──────────────────────────────────────────

/**
 * Get orders for a customer
 */
export async function getCustomerOrders(customerId: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.warn('[queries] getCustomerOrders error:', error?.message)
    return []
  }

  return data
}

/**
 * Get orders for a driver
 */
export async function getDriverOrders(driverId: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*), customer:profiles!orders_customer_id_fkey(full_name, phone), address:addresses(*)')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.warn('[queries] getDriverOrders error:', error?.message)
    return []
  }

  return data
}

/**
 * Get all orders for a store (admin view)
 */
export async function getStoreOrders(storeId: string, status?: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  let query = supabase
    .from('orders')
    .select('*, items:order_items(*), customer:profiles!orders_customer_id_fkey(full_name, email, phone), driver:profiles!orders_driver_id_fkey(full_name, phone), address:addresses(*)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error || !data) {
    console.warn('[queries] getStoreOrders error:', error?.message)
    return []
  }

  return data
}

// ─── Notifications Queries ──────────────────────────────────

/**
 * Get notifications for a user
 */
export async function getNotifications(userId: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !data) {
    console.warn('[queries] getNotifications error:', error?.message)
    return []
  }

  return data
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = createServiceClient()
  if (!supabase) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.warn('[queries] getUnreadNotificationCount error:', error?.message)
    return 0
  }

  return count || 0
}

// ─── Delivery Zone Queries ──────────────────────────────────

/**
 * Get delivery zones for a store
 */
export async function getDeliveryZones(storeId: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)

  if (error || !data) {
    console.warn('[queries] getDeliveryZones error:', error?.message)
    return []
  }

  return data
}

// ─── Promotion Queries ──────────────────────────────────────

/**
 * Get active promotions for a store
 */
export async function getActivePromotions(storeId: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .lte('start_date', now)
    .gte('end_date', now)

  if (error || !data) {
    console.warn('[queries] getActivePromotions error:', error?.message)
    return []
  }

  return data
}

// ─── Admin Queries ──────────────────────────────────────────

/**
 * Get all profiles for a store (admin)
 */
export async function getStoreProfiles(storeId: string, role?: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  let query = supabase
    .from('profiles')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (role) {
    query = query.eq('role', role)
  }

  const { data, error } = await query

  if (error || !data) {
    console.warn('[queries] getStoreProfiles error:', error?.message)
    return []
  }

  return data
}

/**
 * Get driver profiles for a store
 */
export async function getStoreDrivers(storeId: string) {
  const supabase = createServiceClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('*, driver:driver_profiles(*)')
    .eq('store_id', storeId)
    .eq('role', 'driver')
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.warn('[queries] getStoreDrivers error:', error?.message)
    return []
  }

  return data
}

// ─── Dashboard Stats ────────────────────────────────────────

/**
 * Get dashboard statistics for a store
 */
export async function getStoreStats(storeId: string) {
  const supabase = createServiceClient()
  if (!supabase) return null

  const [
    ordersToday,
    revenueToday,
    totalCustomers,
    totalProducts,
    pendingOrders,
    activeDrivers,
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from('orders').select('total').eq('store_id', storeId).eq('payment_status', 'paid').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('store_id', storeId).eq('role', 'customer'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', storeId).eq('is_available', true),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId).in('status', ['placed', 'confirmed', 'picking']),
    supabase.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('is_on_duty', true),
  ])

  const todayRevenue = revenueToday.data?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0

  return {
    ordersToday: ordersToday.count || 0,
    revenueToday: todayRevenue,
    totalCustomers: totalCustomers.count || 0,
    totalProducts: totalProducts.count || 0,
    pendingOrders: pendingOrders.count || 0,
    activeDrivers: activeDrivers.count || 0,
  }
}
