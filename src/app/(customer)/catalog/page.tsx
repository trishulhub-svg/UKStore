import {
  getDefaultStore,
  getCategories,
  getProducts,
  getProductsByCategory,
  getCategoryBySlug,
  searchProducts,
} from '@/lib/supabase/queries'
import { CatalogClient } from '@/components/customer/catalog-client'
import type { Category, ProductWithCategory } from '@/types'

interface CatalogPageProps {
  searchParams: Promise<{ category?: string; q?: string }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams
  const storeId = 'store-fresh-mart-001'

  const [store, categories] = await Promise.all([
    getDefaultStore(),
    getCategories(storeId),
  ])

  let products: ProductWithCategory[] = []
  let activeCategory: Category | null = null
  let searchQuery: string | null = null

  if (params.q) {
    // Search mode
    searchQuery = params.q
    products = await searchProducts(storeId, params.q)
  } else if (params.category) {
    // Category filter mode
    activeCategory = await getCategoryBySlug(storeId, params.category)
    if (activeCategory) {
      products = await getProductsByCategory(storeId, activeCategory.id)
    } else {
      products = await getProducts(storeId)
    }
  } else {
    // Show all products
    products = await getProducts(storeId)
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Available</h1>
          <p className="text-gray-500">We&apos;re sorry, the store is currently unavailable.</p>
        </div>
      </div>
    )
  }

  return (
    <CatalogClient
      store={store}
      categories={categories}
      products={products}
      activeCategory={activeCategory}
      searchQuery={searchQuery}
    />
  )
}
