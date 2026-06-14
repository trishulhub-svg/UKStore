import { getDefaultStore, getCategories, getFeaturedProducts } from '@/lib/supabase/queries'
import { HomeClient } from '@/components/customer/home-client'

export const dynamic = 'force-dynamic'

const STORE_ID = 'store-fresh-mart-001'

export default async function Home() {
  const [store, categories, featuredProducts] = await Promise.all([
    getDefaultStore(),
    getCategories(STORE_ID),
    getFeaturedProducts(STORE_ID),
  ])

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Available</h1>
          <p className="text-gray-500">We&apos;re sorry, the store is currently unavailable. Please try again later.</p>
        </div>
      </div>
    )
  }

  return (
    <HomeClient
      store={store}
      categories={categories}
      featuredProducts={featuredProducts}
    />
  )
}
