'use client'

import Link from 'next/link'
import { Truck, Leaf, Clock, ChevronRight, User, Store as StoreIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/vat'
import { authGetSession, getRoleBasedRedirect, type AuthUser } from '@/lib/auth-client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Store, Category, ProductWithCategory } from '@/types'
import { PostcodeGate, getSavedPostcode, clearSavedPostcode } from '@/components/customer/postcode-gate'
import { BannerCarousel } from '@/components/customer/banner-carousel'
import { CategoryProductSlider } from '@/components/customer/category-product-slider'
import { apiFetch } from '@/lib/api-fetch'

// Category icons for the sub-category slider
const categoryIcons: Record<string, string> = {
  'fruits-vegetables': '🥬',
  'dairy-eggs': '🥛',
  'meat-fish': '🥩',
  'bakery': '🍞',
  'pantry': '🫙',
  'drinks': '🧃',
  'frozen': '🧊',
  'snacks-sweets': '🍫',
  'household': '🧹',
  'baby-child': '🍼',
  'health-beauty': '💊',
  'pet-supplies': '🐾',
}

// Essential categories shown first in the slider
const essentialCategoryOrder = [
  'fruits-vegetables',
  'dairy-eggs',
  'pantry',
  'meat-fish',
  'bakery',
  'drinks',
  'frozen',
  'snacks-sweets',
]

interface CategoryWithProducts {
  id: string
  name: string
  slug: string
  description?: string | null
  image_url?: string | null
  sort_order: number
  products: ProductWithCategory[]
}

interface HomeClientProps {
  store: Store
  categories: Category[]
  featuredProducts: ProductWithCategory[]
}

export function HomeClient({ store, categories, featuredProducts }: HomeClientProps) {
  const router = useRouter()
  const addItem = useCartStore((state) => state.addItem)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [deliveryPostcode, setDeliveryPostcode] = useState<string | null>(() => getSavedPostcode())
  const [postcodeVerified, setPostcodeVerified] = useState(() => !!getSavedPostcode())
  const [storeOpen, setStoreOpen] = useState<boolean | null>(null)
  const [openingHours, setOpeningHours] = useState<Record<string, { open: string; close: string; closed: boolean }> | null>(null)
  const [categoriesWithProducts, setCategoriesWithProducts] = useState<CategoryWithProducts[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    authGetSession().then(({ user }) => {
      setUser(user)
      if (user?.role) {
        const redirectPath = getRoleBasedRedirect(user.role)
        if (redirectPath !== '/') {
          router.replace(redirectPath)
        }
      }
    })
  }, [router])

  // Check store status
  useEffect(() => {
    apiFetch('/api/store/status')
      .then((r) => r.json())
      .then((data) => {
        setStoreOpen(data.isOpen)
        setOpeningHours(data.openingHours)
      })
      .catch(() => {
        setStoreOpen(true)
      })
  }, [])

  // Fetch products grouped by category
  useEffect(() => {
    apiFetch('/api/products/by-category')
      .then((r) => r.json())
      .then((data) => {
        setCategoriesWithProducts(data.categories || [])
        setIsLoadingCategories(false)
      })
      .catch(() => {
        setIsLoadingCategories(false)
      })
  }, [])

  const handlePostcodeVerified = useCallback((postcode: string) => {
    setDeliveryPostcode(postcode)
    setPostcodeVerified(true)
  }, [])

  const handleChangePostcode = useCallback(() => {
    clearSavedPostcode()
    setDeliveryPostcode(null)
    setPostcodeVerified(false)
  }, [])

  const userFirstName = user?.name?.split(' ')[0] || null

  // Format opening hours for display
  const dayNames: Record<string, string> = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
    thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  }

  const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
  const todayHours = openingHours?.[todayKey]

  // Sort categories: essential ones first, then by sort_order
  const sortedCategories = [...categories].sort((a, b) => {
    const aIndex = essentialCategoryOrder.indexOf(a.slug)
    const bIndex = essentialCategoryOrder.indexOf(b.slug)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.sort_order - b.sort_order
  })

  return (
    <CustomerLayout storeName={store.name} store={store}>
      {/* Store Closed Overlay */}
      {storeOpen === false && (
        <div className="fixed inset-0 z-[60] bg-gray-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <StoreIcon className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Store is Currently Closed</h2>
            <p className="text-gray-600 mb-6">
              We&apos;re not accepting orders right now. Please check back during our opening hours.
            </p>
            {openingHours && (
              <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
                <h3 className="font-semibold text-sm text-gray-900 mb-3">Opening Hours</h3>
                <div className="space-y-1.5">
                  {Object.entries(openingHours).map(([day, hours]) => (
                    <div key={day} className={`flex justify-between text-sm ${day === todayKey ? 'font-bold text-[#16a34a]' : 'text-gray-600'}`}>
                      <span>{dayNames[day] || day}{day === todayKey ? ' (Today)' : ''}</span>
                      <span>{hours.closed ? 'Closed' : `${hours.open} - ${hours.close}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {todayHours && !todayHours.closed && (
              <p className="text-sm text-gray-500">
                We open at <strong>{todayHours.open}</strong> and close at <strong>{todayHours.close}</strong> today.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Postcode Gate */}
      <PostcodeGate
        onVerified={handlePostcodeVerified}
        savedPostcode={deliveryPostcode}
      />

      {/* ═══════════════════════════════════════════════════════════
          BANNER CAROUSEL
      ═══════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <BannerCarousel />
      </section>

      {/* ═══════════════════════════════════════════════════════════
          DELIVERY INFO BAR
      ═══════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SUB-CATEGORY SLIDER (Horizontal Scroll)
      ═══════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Shop by Category</h2>
          <Link href="/catalog" className="text-sm font-medium text-[#16a34a] hover:underline">
            View All <ChevronRight className="inline h-3 w-3" />
          </Link>
        </div>
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {sortedCategories.map((category) => (
            <Link
              key={category.id}
              href={`/catalog?category=${category.slug}`}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:border-[#16a34a]/30 group-hover:bg-green-50 transition-all duration-200">
                <span className="text-2xl sm:text-3xl">
                  {categoryIcons[category.slug] || '🛒'}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-gray-600 group-hover:text-[#16a34a] transition-colors text-center leading-tight max-w-[60px] sm:max-w-[72px] truncate">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CATEGORY PRODUCT SLIDERS
      ═══════════════════════════════════════════════════════════ */}
      {isLoadingCategories ? (
        // Loading skeleton
        <div className="py-8 space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="h-6 bg-gray-200 rounded w-40 animate-pulse mb-4" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex-shrink-0 w-[165px]">
                    <div className="aspect-square bg-gray-200 rounded-lg animate-pulse mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse mb-1" />
                    <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        categoriesWithProducts.map((category) => (
          <CategoryProductSlider
            key={category.id}
            category={category}
            products={category.products}
          />
        ))
      )}

      {/* Fallback: If no categories with products from API, use the old featured products */}
      {!isLoadingCategories && categoriesWithProducts.length === 0 && featuredProducts.length > 0 && (
        <section className="bg-gray-50 py-10 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
              <Link href="/catalog" className="text-sm font-medium text-[#16a34a] hover:underline">
                View All <ChevronRight className="inline h-3 w-3" />
              </Link>
            </div>
            <p className="text-sm text-gray-500">More products coming soon!</p>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          BOTTOM CTA SECTION
      ═══════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
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
              <h2 className="text-xl sm:text-2xl font-bold">Join {store.name} Today</h2>
              <p className="text-green-100 mt-2 max-w-md mx-auto">
                Create an account to start ordering fresh groceries with same-day delivery.
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
