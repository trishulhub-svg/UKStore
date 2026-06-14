'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, Minus, Plus, ChevronRight, Package, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { useCartStore } from '@/store/cart'
import { formatPrice, getVatRateLabel } from '@/lib/vat'
import type { Store, ProductWithCategory } from '@/types'

interface ProductDetailClientProps {
  store: Store
  product: ProductWithCategory
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

function getStockStatus(product: ProductWithCategory) {
  if (product.stock_quantity === 0) {
    return { label: 'Out of Stock', color: 'text-red-600', bgColor: 'bg-red-50', available: false }
  }
  if (product.stock_quantity <= 10) {
    return { label: 'Low Stock', color: 'text-amber-600', bgColor: 'bg-amber-50', available: true }
  }
  return { label: 'In Stock', color: 'text-[#16a34a]', bgColor: 'bg-green-50', available: true }
}

export function ProductDetailClient({ store, product }: ProductDetailClientProps) {
  const addItem = useCartStore((state) => state.addItem)
  const [quantity, setQuantity] = useState(1)
  const [substitutePreference, setSubstitutePreference] = useState<'closest_match' | 'do_not_substitute'>('closest_match')

  const stockStatus = getStockStatus(product)

  const handleAddToCart = () => {
    addItem(product, quantity, substitutePreference)
    setQuantity(1)
  }

  const incrementQuantity = () => setQuantity((q) => q + 1)
  const decrementQuantity = () => setQuantity((q) => Math.max(1, q - 1))

  return (
    <CustomerLayout storeName={store.name}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-sm">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3 w-3" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink href="/catalog" className="text-sm">Shop</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3 w-3" />
            </BreadcrumbSeparator>
            {product.category && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href={`/catalog?category=${product.category.slug}`}
                    className="text-sm"
                  >
                    {product.category.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3 w-3" />
                </BreadcrumbSeparator>
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="text-sm font-medium">{product.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image */}
          <div className="aspect-square bg-gray-100 rounded-xl relative flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-6xl sm:text-8xl text-gray-300">
                {categoryIcons[product.category?.slug || ''] || '🛒'}
              </span>
            )}
            {product.is_hfss && (
              <Badge className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1 text-sm">
                <AlertTriangle className="h-3 w-3 mr-1" />
                HFSS
              </Badge>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            {/* Category Tag */}
            {product.category && (
              <Link
                href={`/catalog?category=${product.category.slug}`}
                className="text-sm font-medium text-[#16a34a] hover:underline mb-2 self-start"
              >
                {product.category.name}
              </Link>
            )}

            {/* Product Name */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {product.name}
            </h1>

            {/* Description */}
            {product.description && (
              <p className="text-gray-600 mt-3 leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Price & VAT */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-bold text-gray-900">
                {formatPrice(product.price)}
              </span>
              <span className="text-sm text-gray-500">
                per {product.unit}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {getVatRateLabel(product.vat_rate)}
            </p>

            {/* Stock Status */}
            <div className="mt-4 flex items-center gap-2">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${stockStatus.bgColor} ${stockStatus.color}`}>
                <Package className="h-3.5 w-3.5" />
                {stockStatus.label}
              </div>
              {stockStatus.available && (
                <span className="text-xs text-gray-400">
                  {product.stock_quantity} available
                </span>
              )}
            </div>

            {/* HFSS Notice */}
            {product.is_hfss && (
              <Card className="mt-4 border-amber-200 bg-amber-50">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">HFSS Product</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        This product is classified as High in Fat, Salt or Sugar under UK regulations.
                        It may be subject to promotional restrictions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator className="my-6" />

            {/* Quantity Selector */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Quantity</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-semibold text-lg">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    onClick={incrementQuantity}
                    disabled={quantity >= product.stock_quantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Substitute Preference */}
              <div>
                <Label className="text-sm font-medium text-gray-700">Substitute Preference</Label>
                <p className="text-xs text-gray-500 mb-2">
                  If this item is unavailable, what should we do?
                </p>
                <RadioGroup
                  value={substitutePreference}
                  onValueChange={(val) => setSubstitutePreference(val as 'closest_match' | 'do_not_substitute')}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 min-h-[44px]">
                    <RadioGroupItem value="closest_match" id="closest_match" />
                    <Label htmlFor="closest_match" className="text-sm font-normal cursor-pointer py-2">
                      Closest match — pick the most similar alternative
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 min-h-[44px]">
                    <RadioGroupItem value="do_not_substitute" id="do_not_substitute" />
                    <Label htmlFor="do_not_substitute" className="text-sm font-normal cursor-pointer py-2">
                      Do not substitute — refund if unavailable
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Add to Cart */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="flex-1 bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold text-base h-12"
                onClick={handleAddToCart}
                disabled={!stockStatus.available}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {!stockStatus.available ? 'Out of Stock' : `Add to Cart — ${formatPrice(product.price * quantity)}`}
              </Button>
            </div>

            {/* Delivery Info */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-[#16a34a]">🚚</span>
                  Delivery from {formatPrice(store.base_delivery_fee)}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-[#16a34a]">📦</span>
                  Free delivery over {formatPrice(store.free_delivery_threshold)}
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Product Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">Unit</div>
                <div className="text-gray-900 font-medium">{product.unit}</div>
                {product.weight_kg && (
                  <>
                    <div className="text-gray-500">Weight</div>
                    <div className="text-gray-900 font-medium">{product.weight_kg}kg</div>
                  </>
                )}
                {product.barcode && (
                  <>
                    <div className="text-gray-500">Barcode</div>
                    <div className="text-gray-900 font-medium">{product.barcode}</div>
                  </>
                )}
                <div className="text-gray-500">VAT Rate</div>
                <div className="text-gray-900 font-medium">{getVatRateLabel(product.vat_rate)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  )
}
