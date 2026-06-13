'use client'

import Link from 'next/link'
import { ShoppingCart, Truck, Clock, Leaf, ChevronRight, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/vat'
import { authGetSession, type AuthUser } from '@/lib/auth-client'
import { useEffect, useState } from 'react'
import type { Store, Category, ProductWithCategory } from '@/types'

interface HomeClientProps {
  store: Store
  categories: Category[]
  featuredProducts: ProductWithCategory[]
}

const categoryIcons: Record<string, string> = {
  'fruits-vegetables': '🥬',
  'dairy-eggs': '🥛',
  'meat-fish': '🥩',
  'bakery': '🍞',
  'pantry': '🫙',
  'drinks': '🧃',
  'frozen': '🧊',
  'snacks-sweets': '🍫',
}

export function HomeClient({ store, categories, featuredProducts }: HomeClientProps) {
  const addItem = useCartStore((state) => state.addItem)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    authGetSession().then(({ user }) => {
      setUser(user)
    })
  }, [])

  const userFirstName = user?.name?.split(' ')[0] || null

  return (
    <CustomerLayout storeName={store.name}>
      {/* ═══════════════════════════════════════════════════════════
          HERO SECTION
          Logged out: Full-width marketing with CTAs pointing to navbar auth
          Logged in:  Personalized welcome with Shop Now
      ═══════════════════════════════════════════════════════════ */}
      <section className="relative bg-gradient-to-br from-[#16a34a] to-[#15803d] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/logo.svg')] bg-center bg-no-repeat opacity-5" />

        {user ? (
          /* ── LOGGED IN HERO ── */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 relative z-10">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                Welcome back, {userFirstName || 'Shopper'}!
              </h1>
              <p className="mt-4 text-lg sm:text-xl text-green-100 max-w-lg">
                Ready to order from {store.name}? Same-day delivery within {store.delivery_radius_km}km. Free delivery on orders over {formatPrice(store.free_delivery_threshold)}.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/catalog">
                  <Button size="lg" className="bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold px-8">
                    Shop Now
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/account">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                    <User className="mr-1.5 h-4 w-4" /> My Account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* ── LOGGED OUT HERO — Marketing with CTAs ── */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 relative z-10">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                Fresh Groceries,<br />Delivered to Your Door
              </h1>
              <p className="mt-4 text-lg sm:text-xl text-green-100 max-w-lg mx-auto">
                Order from {store.name} and get same-day delivery within {store.delivery_radius_km}km. Free delivery on orders over {formatPrice(store.free_delivery_threshold)}.
              </p>
              <div className="mt-6 flex items-center justify-center gap-4 text-sm text-green-200">
                <span className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> Same-Day Delivery</span>
                <span className="flex items-center gap-1.5"><Leaf className="h-4 w-4" /> Fresh & Local</span>
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Order by 2pm</span>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/catalog">
                  <Button size="lg" className="bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold px-8">
                    Browse Products
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-green-200">
                Use <strong>Sign In</strong> or <strong>Register</strong> in the navigation bar above to create an account and start ordering.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Delivery Info Banner */}
      <section className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-[#16a34a]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Same-Day Delivery</p>
                <p className="text-xs text-gray-500">Order before 2pm for same-day</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                <Leaf className="h-5 w-5 text-[#16a34a]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Free Delivery Over {formatPrice(store.free_delivery_threshold)}</p>
                <p className="text-xs text-gray-500">Save on bigger orders</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-[#16a34a]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{store.delivery_radius_km}km Delivery Radius</p>
                <p className="text-xs text-gray-500">From {formatPrice(store.base_delivery_fee)} delivery fee</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Categories Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Shop by Category</h2>
          <Link href="/catalog" className="text-sm font-medium text-[#16a34a] hover:underline">
            View All <ChevronRight className="inline h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((category) => (
            <Link key={category.id} href={`/catalog?category=${category.slug}`}>
              <Card className="group hover:shadow-md transition-all duration-200 hover:border-[#16a34a]/30 cursor-pointer">
                <CardContent className="p-4 sm:p-5 text-center">
                  <div className="text-3xl sm:text-4xl mb-2">
                    {categoryIcons[category.slug] || '🛒'}
                  </div>
                  <h3 className="font-medium text-sm sm:text-base text-gray-900 group-hover:text-[#16a34a] transition-colors">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block line-clamp-1">
                      {category.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="bg-gray-50 py-10 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
            <Link href="/catalog" className="text-sm font-medium text-[#16a34a] hover:underline">
              View All <ChevronRight className="inline h-3 w-3" />
            </Link>
          </div>
          {featuredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No featured products available at the moment.</p>
              <p className="text-sm mt-1">Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {featuredProducts.map((product) => (
                <Card key={product.id} className="group hover:shadow-md transition-all duration-200 overflow-hidden">
                  <Link href={`/product/${product.slug}`}>
                    <div className="aspect-square bg-gray-200 relative flex items-center justify-center">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl text-gray-400">
                          {categoryIcons[product.category?.slug || ''] || '🛒'}
                        </span>
                      )}
                      {product.is_hfss && (
                        <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                          HFSS
                        </Badge>
                      )}
                    </div>
                  </Link>
                  <CardContent className="p-3 sm:p-4">
                    <Link href={`/product/${product.slug}`}>
                      <h3 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-[#16a34a] transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {product.category?.name}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-base text-gray-900">
                        {formatPrice(product.price)}
                      </span>
                      <Button
                        size="sm"
                        className="bg-[#f97316] hover:bg-[#ea580c] text-white h-8 px-3 text-xs"
                        onClick={() => addItem(product)}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA Section — Auth-aware */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {user ? (
          <div className="bg-gradient-to-r from-[#16a34a] to-[#15803d] rounded-xl p-6 sm:p-8 text-white text-center">
            <h2 className="text-xl sm:text-2xl font-bold">Ready to Order?</h2>
            <p className="text-green-100 mt-2 max-w-md mx-auto">
              Browse our full range of fresh groceries and get delivery straight to your door.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              <Link href="/catalog">
                <Button size="lg" className="bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold">
                  Start Shopping
                </Button>
              </Link>
              <Link href="/account">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  View Orders
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-[#16a34a] to-[#15803d] rounded-xl p-6 sm:p-8 text-white">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-xl sm:text-2xl font-bold">Join Fresh Mart Today</h2>
              <p className="text-green-100 mt-2 max-w-md mx-auto">
                Create an account to start ordering fresh groceries with same-day delivery. Use the Sign In or Register button in the navigation bar above.
              </p>
              <div className="mt-4">
                <Link href="/catalog">
                  <Button size="lg" className="bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold">
                    Browse Products <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="text-green-200 text-xs mt-3">
                No credit card required. Browse as a guest or sign up for exclusive offers.
              </p>
            </div>
          </div>
        )}
      </section>
    </CustomerLayout>
  )
}
