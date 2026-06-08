import { getDefaultStore, getCategories, getFeaturedProducts } from '@/lib/supabase/queries'
import { HomeClient } from '@/components/customer/home-client'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [store, categories, featuredProducts] = await Promise.all([
    getDefaultStore(),
    getCategories('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'),
    getFeaturedProducts('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'),
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
