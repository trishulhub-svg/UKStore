'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/vat'
import { toast } from 'sonner'
import type { ProductWithCategory } from '@/types'

interface CrossSellSliderProps {
  title: string
  products: ProductWithCategory[]
  emptyMessage?: string
}

export function CrossSellSlider({ title, products, emptyMessage = 'No products available' }: CrossSellSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const addItem = useCartStore((state) => state.addItem)

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = 220
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  const handleQuickAdd = (product: ProductWithCategory) => {
    addItem(product, 1)
    toast.success(`${product.name} added to cart`)
  }

  if (!products || products.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.slug}`}
            className="flex-shrink-0 w-[180px] group"
          >
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-shadow hover:shadow-md">
              {/* Product Image */}
              <div className="aspect-square bg-gray-50 relative flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <ShoppingCart className="h-8 w-8 text-gray-300" />
                )}
                {/* Quick Add Button */}
                <Button
                  size="icon"
                  className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-[#f97316] hover:bg-[#ea580c] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleQuickAdd(product)
                  }}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                </Button>
                {/* Discount Badge */}
                {product.original_price && product.original_price > product.price && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {Math.round(((product.original_price - product.price) / product.original_price) * 100)}% OFF
                  </span>
                )}
              </div>

              {/* Product Info */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm font-bold text-gray-900">{formatPrice(product.price)}</span>
                  {product.original_price && product.original_price > product.price && (
                    <span className="text-[10px] text-gray-400 line-through">{formatPrice(product.original_price)}</span>
                  )}
                </div>
                {product.brand && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{product.brand}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// Fetching wrapper component
interface CrossSellSectionProps {
  title: string
  categoryId?: string
  excludeProductId?: string
  limit?: number
  storeId?: string
  complementaryCategoryIds?: string[]
}

export function CrossSellSection({
  title,
  categoryId,
  excludeProductId,
  limit = 10,
  storeId = 'store-fresh-mart-001',
  complementaryCategoryIds,
}: CrossSellSectionProps) {
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (categoryId) params.set('categoryId', categoryId)
        if (storeId) params.set('storeId', storeId)
        if (excludeProductId) params.set('excludeProductId', excludeProductId)
        params.set('limit', String(limit))

        const res = await fetch(`/api/products?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setProducts(data.products || [])
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }

    if (categoryId) {
      fetchProducts()
    } else if (complementaryCategoryIds && complementaryCategoryIds.length > 0) {
      // Fetch from multiple categories and combine
      async function fetchMultipleCategories() {
        try {
          setLoading(true)
          const allProducts: ProductWithCategory[] = []
          const perCategory = Math.max(Math.ceil(limit / complementaryCategoryIds.length), 3)

          for (const catId of complementaryCategoryIds) {
            const params = new URLSearchParams()
            params.set('categoryId', catId)
            if (storeId) params.set('storeId', storeId)
            if (excludeProductId) params.set('excludeProductId', excludeProductId)
            params.set('limit', String(perCategory))

            const res = await fetch(`/api/products?${params.toString()}`)
            if (res.ok) {
              const data = await res.json()
              if (data.products) {
                allProducts.push(...data.products)
              }
            }
          }

          setProducts(allProducts.slice(0, limit))
        } catch {
          // Silently fail
        } finally {
          setLoading(false)
        }
      }

      fetchMultipleCategories()
    } else {
      setLoading(false)
    }
  }, [categoryId, complementaryCategoryIds, excludeProductId, limit, storeId])

  if (loading) {
    return (
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[180px]">
              <div className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
              <div className="p-2.5">
                <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-gray-100 rounded w-1/2 mt-1.5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!products || products.length === 0) {
    return null
  }

  return <CrossSellSlider title={title} products={products} />
}
