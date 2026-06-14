import { getPrisma } from '@/lib/auth/prisma'
import type { Store, Category, ProductWithCategory } from '@/types'

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
    is_open: s.isOpen ?? true,
    opening_hours: s.openingHours ? JSON.parse(s.openingHours) : null,
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
    original_price: p.originalPrice ?? null,
    vat_rate: p.vatRate,
    is_hfss: p.isHfss,
    is_age_restricted: p.isAgeRestricted,
    minimum_age: p.minimumAge,
    image_url: p.imageUrl,
    images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : null,
    barcode: p.barcode,
    brand: p.brand ?? null,
    unit: p.unit,
    weight_kg: p.weightKg,
    is_available: p.isAvailable,
    stock_quantity: p.stockQuantity,
    is_featured: p.isFeatured,
    rating: p.rating ?? 0,
    review_count: p.reviewCount ?? 0,
    sort_order: p.sortOrder,
    created_at: p.createdAt?.toISOString?.() ?? p.created_at ?? '',
    updated_at: p.updatedAt?.toISOString?.() ?? p.updated_at ?? '',
    category: p.category ? mapPrismaCategoryToCategory(p.category) : ({} as Category),
  }
}

// ─── Query functions ──────────────────────────────────────────
// Pattern: 1. Try Prisma → 2. Try Supabase → 3. Return empty/null

/**
 * Get store by ID
 */
export async function getStore(storeId: string): Promise<Store | null> {
  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findUnique({ where: { id: storeId } })
    if (store) return mapPrismaStoreToStore(store)
  } catch (err) {
    console.warn('[queries] Prisma getStore failed:', err)
  }

  // No mock data — return null if DB has no data
  return null
}

/**
 * Get the first active store (for single-store MVP)
 */
export async function getDefaultStore(): Promise<Store | null> {
  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findFirst({
      where: { isActive: true },
    })
    if (store) return mapPrismaStoreToStore(store)
  } catch (err) {
    console.warn('[queries] Prisma getDefaultStore failed:', err)
  }

  // No mock data — return null if DB has no data
  return null
}

/**
 * Get all active categories for a store, ordered by sort_order
 */
export async function getCategories(storeId: string): Promise<Category[]> {
  try {
    const prisma = await getPrisma()
    const categories = await prisma.category.findMany({
      where: { storeId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (categories.length > 0) return categories.map(mapPrismaCategoryToCategory)
  } catch (err) {
    console.warn('[queries] Prisma getCategories failed:', err)
  }

  // No mock data — return empty array if DB has no data
  return []
}

/**
 * Get all available products for a store, with category relation
 */
export async function getProducts(storeId: string): Promise<ProductWithCategory[]> {
  try {
    const prisma = await getPrisma()
    const products = await prisma.product.findMany({
      where: { storeId, isAvailable: true },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (products.length > 0) return products.map(mapPrismaProductToProductWithCategory)
  } catch (err) {
    console.warn('[queries] Prisma getProducts failed:', err)
  }

  // No mock data — return empty array if DB has no data
  return []
}

/**
 * Get products filtered by category
 */
export async function getProductsByCategory(storeId: string, categoryId: string): Promise<ProductWithCategory[]> {
  try {
    const prisma = await getPrisma()
    const products = await prisma.product.findMany({
      where: { storeId, categoryId, isAvailable: true },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (products.length > 0) return products.map(mapPrismaProductToProductWithCategory)
  } catch (err) {
    console.warn('[queries] Prisma getProductsByCategory failed:', err)
  }

  // No mock data — return empty array if DB has no data
  return []
}

/**
 * Get featured products only (is_featured = true)
 */
export async function getFeaturedProducts(storeId: string): Promise<ProductWithCategory[]> {
  try {
    const prisma = await getPrisma()
    const products = await prisma.product.findMany({
      where: { storeId, isAvailable: true, isFeatured: true },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (products.length > 0) return products.map(mapPrismaProductToProductWithCategory)
  } catch (err) {
    console.warn('[queries] Prisma getFeaturedProducts failed:', err)
  }

  // No mock data — return empty array if DB has no data
  return []
}

/**
 * Get single product by slug
 */
export async function getProductBySlug(storeId: string, slug: string): Promise<ProductWithCategory | null> {
  try {
    const prisma = await getPrisma()
    const product = await prisma.product.findFirst({
      where: { storeId, slug },
      include: { category: true },
    })
    if (product) return mapPrismaProductToProductWithCategory(product)
  } catch (err) {
    console.warn('[queries] Prisma getProductBySlug failed:', err)
  }

  // No mock data — return null if DB has no data
  return null
}

/**
 * Text search using contains on name
 */
export async function searchProducts(storeId: string, query: string): Promise<ProductWithCategory[]> {
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
    console.warn('[queries] Prisma searchProducts failed:', err)
  }

  // No mock data — return empty array if DB has no data
  return []
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(storeId: string, slug: string): Promise<Category | null> {
  try {
    const prisma = await getPrisma()
    const category = await prisma.category.findFirst({
      where: { storeId, slug, isActive: true },
    })
    if (category) return mapPrismaCategoryToCategory(category)
  } catch (err) {
    console.warn('[queries] Prisma getCategoryBySlug failed:', err)
  }

  // No mock data — return null if DB has no data
  return null
}
