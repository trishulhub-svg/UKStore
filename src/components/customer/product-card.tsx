'use client'

import Link from 'next/link'
import { ShoppingCart, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { formatPrice, formatUnitPrice } from '@/lib/vat'
import { toast } from 'sonner'
import type { Product, ProductWithCategory } from '@/types'

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

interface ProductCardProps {
  product: ProductWithCategory | Product
  /** Compact mode for horizontal sliders (smaller text, tighter spacing) */
  compact?: boolean
  /** Show ADD button overlay on image */
  showAddOverlay?: boolean
}

export function ProductCard({ product, compact = false, showAddOverlay = true }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem)

  const categorySlug = 'category' in product ? (product as ProductWithCategory).category?.slug : ''
  const categoryName = 'category' in product ? (product as ProductWithCategory).category?.name : ''

  // Discount calculation
  const hasDiscount = product.original_price && product.original_price > product.price
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.original_price!) * 100)
    : 0

  // Rating display
  const hasRating = product.rating > 0

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(product as Product)
    toast.success(`${product.name} added to basket`, {
      duration: 1500,
    })
  }

  return (
    <Card className="group hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 bg-white">
      {/* Image Section */}
      <Link href={`/product/${product.slug}`} className="block relative">
        <div className={`${compact ? 'aspect-square' : 'aspect-square'} bg-gray-50 relative flex items-center justify-center overflow-hidden`}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <span className="text-4xl text-gray-300">
              {categoryIcons[categorySlug || ''] || '🛒'}
            </span>
          )}

          {/* Discount Badge */}
          {hasDiscount && (
            <Badge className="absolute top-2 left-2 bg-[#dc2626] text-white text-[10px] font-bold px-1.5 py-0.5 border-0 shadow-sm">
              {discountPercent}% OFF
            </Badge>
          )}

          {/* HFSS Badge */}
          {product.is_hfss && (
            <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 border-0">
              HFSS
            </Badge>
          )}

          {/* ADD Button Overlay */}
          {showAddOverlay && product.stock_quantity > 0 && (
            <Button
              size="sm"
              className="absolute bottom-2 right-2 bg-[#16a34a] hover:bg-[#15803d] text-white h-8 w-8 p-0 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              onClick={handleAddToCart}
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}

          {/* Out of Stock Overlay */}
          {product.stock_quantity === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">Out of Stock</span>
            </div>
          )}
        </div>
      </Link>

      {/* Content Section */}
      <CardContent className={`${compact ? 'p-2.5' : 'p-3 sm:p-4'}`}>
        <Link href={`/product/${product.slug}`}>
          <h3 className={`font-medium text-gray-900 line-clamp-2 group-hover:text-[#16a34a] transition-colors ${compact ? 'text-xs' : 'text-sm'}`}>
            {product.name}
          </h3>
        </Link>

        {/* Weight / Volume */}
        {product.weight_kg && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {product.weight_kg >= 1 ? `${product.weight_kg}kg` : `${Math.round(product.weight_kg * 1000)}g`}
          </p>
        )}

        {/* Brand */}
        {product.brand && (
          <p className="text-[10px] text-gray-400 mt-0.5">{product.brand}</p>
        )}

        {/* Rating */}
        {hasRating && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px]">⭐</span>
            <span className="text-[10px] font-medium text-gray-600">{product.rating.toFixed(1)}</span>
            {product.review_count > 0 && (
              <span className="text-[10px] text-gray-400">({product.review_count})</span>
            )}
          </div>
        )}

        {/* Price Block */}
        <div className="flex items-end justify-between mt-1.5">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className={`font-bold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
                {formatPrice(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-gray-400 line-through">
                  {formatPrice(product.original_price!)}
                </span>
              )}
            </div>
            {/* Unit price for UK Trading Standards */}
            {formatUnitPrice(product.price, product.weight_kg, null, product.unit) && (
              <span className="text-[10px] text-gray-500 block">
                {formatUnitPrice(product.price, product.weight_kg, null, product.unit)}
              </span>
            )}
          </div>

          {/* ADD Button (inline, always visible) */}
          {!showAddOverlay && (
            product.stock_quantity > 0 ? (
              <Button
                size="sm"
                className="bg-[#16a34a] hover:bg-[#15803d] text-white h-9 px-3 text-xs flex-shrink-0"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Add
              </Button>
            ) : (
              <Button size="sm" disabled className="h-9 px-3 text-xs flex-shrink-0">
                Sold Out
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}
