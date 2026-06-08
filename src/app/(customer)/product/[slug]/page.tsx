import { getDefaultStore, getProductBySlug } from '@/lib/supabase/queries'
import { ProductDetailClient } from '@/components/customer/product-detail-client'
import { notFound } from 'next/navigation'

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const storeId = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

  const [store, product] = await Promise.all([
    getDefaultStore(),
    getProductBySlug(storeId, slug),
  ])

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

  if (!product) {
    notFound()
  }

  return <ProductDetailClient store={store} product={product} />
}
