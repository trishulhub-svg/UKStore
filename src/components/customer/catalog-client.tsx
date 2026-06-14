'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { ProductCard } from '@/components/customer/product-card'
import type { Store, Category, ProductWithCategory } from '@/types'

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

interface CatalogClientProps {
  store: Store
  categories: Category[]
  products: ProductWithCategory[]
  activeCategory: Category | null
  searchQuery: string | null
}

interface CategorySidebarProps {
  categories: Category[]
  activeCategory: Category | null
  searchQuery: string | null
  onCategoryClick: (slug: string) => void
  onClearFilters: () => void
}

function CategorySidebar({ categories, activeCategory, searchQuery, onCategoryClick, onClearFilters }: CategorySidebarProps) {
  return (
    <div className="space-y-1">
      <button
        onClick={onClearFilters}
        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          !activeCategory && !searchQuery
            ? 'bg-[#16a34a]/10 text-[#16a34a]'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        All Products
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryClick(category.slug)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeCategory?.id === category.id
              ? 'bg-[#16a34a]/10 text-[#16a34a]'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="text-base">{categoryIcons[category.slug] || '🛒'}</span>
          {category.name}
        </button>
      ))}
    </div>
  )
}

export function CatalogClient({
  store,
  categories,
  products,
  activeCategory,
  searchQuery,
}: CatalogClientProps) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState(searchQuery || '')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = searchInput.trim()
      if (trimmed) {
        router.push(`/catalog?q=${encodeURIComponent(trimmed)}`)
      } else {
        router.push('/catalog')
      }
    },
    [searchInput, router]
  )

  const handleCategoryClick = useCallback(
    (slug: string) => {
      router.push(`/catalog?category=${slug}`)
      setMobileFiltersOpen(false)
    },
    [router]
  )

  const handleClearFilters = useCallback(() => {
    setSearchInput('')
    router.push('/catalog')
    setMobileFiltersOpen(false)
  }, [router])

  return (
    <CustomerLayout storeName={store.name} store={store}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {searchQuery
              ? `Search: "${searchQuery}"`
              : activeCategory
              ? activeCategory.name
              : 'All Products'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} product{products.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Search Bar + Mobile Filter Toggle */}
        <div className="flex gap-3 mb-6">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
            <Button type="submit" variant="outline" className="hidden sm:flex">
              Search
            </Button>
          </form>

          {/* Mobile filter button */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-72">
              <SheetTitle className="text-lg font-semibold mb-4">Categories</SheetTitle>
              <CategorySidebar
                categories={categories}
                activeCategory={activeCategory}
                searchQuery={searchQuery}
                onCategoryClick={handleCategoryClick}
                onClearFilters={handleClearFilters}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Active Filters */}
        {(activeCategory || searchQuery) && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {activeCategory && (
              <Badge variant="secondary" className="gap-1">
                {activeCategory.name}
                <button onClick={handleClearFilters} className="ml-1 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchQuery}
                <button onClick={handleClearFilters} className="ml-1 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <button
              onClick={handleClearFilters}
              className="text-sm text-[#16a34a] hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-20">
              <h2 className="font-semibold text-sm text-gray-900 mb-3">Categories</h2>
              <CategorySidebar
                categories={categories}
                activeCategory={activeCategory}
                searchQuery={searchQuery}
                onCategoryClick={handleCategoryClick}
                onClearFilters={handleClearFilters}
              />
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">No products found</p>
                <p className="text-gray-400 text-sm mt-1">
                  Try a different search or browse categories
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleClearFilters}
                >
                  View All Products
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    showAddOverlay={false}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  )
}
