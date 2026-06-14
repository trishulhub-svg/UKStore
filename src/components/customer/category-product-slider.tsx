'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/customer/product-card'
import type { ProductWithCategory } from '@/types'

interface CategoryProductSliderProps {
  category: {
    id: string
    name: string
    slug: string
    description?: string | null
    image_url?: string | null
  }
  products: ProductWithCategory[]
}

export function CategoryProductSlider({ category, products }: CategoryProductSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -280, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 280, behavior: 'smooth' })
    }
  }

  if (products.length === 0) return null

  return (
    <section className="py-4 sm:py-6" id={`category-${category.slug}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {category.name}
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/catalog?category=${category.slug}`}
              className="text-sm font-semibold text-[#16a34a] hover:text-[#15803d] flex items-center gap-0.5 transition-colors"
            >
              See All
              <ChevronRight className="h-4 w-4" />
            </Link>
            {/* Desktop scroll arrows */}
            <div className="hidden md:flex items-center gap-1 ml-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full border-gray-200"
                onClick={scrollLeft}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full border-gray-200"
                onClick={scrollRight}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Horizontal Scrollable Products */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 w-[150px] sm:w-[165px] md:w-[175px]"
            >
              <ProductCard product={product} compact showAddOverlay />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
