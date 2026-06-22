'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingCart, Minus, Plus, ChevronRight, Package, AlertTriangle, ArrowRight, Star, Tag, ZoomIn } from 'lucide-react'
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
import { useCartSidebarStore } from '@/stores/cart-sidebar-store'
import { formatPrice, getVatRateLabel } from '@/lib/vat'
import { TrustBadges } from '@/components/customer/trust-badges'
import { CrossSellSection } from '@/components/customer/cross-sell-slider'
import { toast } from 'sonner'
import type { Store, ProductWithCategory, Promotion } from '@/types'
import { apiFetch } from '@/lib/api-fetch'

interface SubstituteProduct {
  id: string
  name: string
  slug: string
  price: number
  imageUrl: string | null
  stockQuantity: number
  isAvailable: boolean
  category: { id: string; name: string; slug: string }
}

interface ProductDetailClientProps {
  store: Store
  product: ProductWithCategory
  allCategories?: { id: string; name: string; slug: string }[]
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
  'household': '🧹',
  'baby-care': '🍼',
  'health-beauty': '💊',
  'pet-care': '🐾',
}

function getStockStatus(product: ProductWithCategory) {
  if (product.stock_quantity === 0) {
    return { label: 'Out of Stock', color: 'text-red-600', bgColor: 'bg-red-50', dotColor: 'bg-red-500', available: false }
  }
  if (product.stock_quantity <= 10) {
    return { label: 'Low Stock', color: 'text-amber-600', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500', available: true }
  }
  return { label: 'In Stock', color: 'text-[#16a34a]', bgColor: 'bg-green-50', dotColor: 'bg-green-500', available: true }
}

export function ProductDetailClient({ store, product, allCategories = [] }: ProductDetailClientProps) {
  const addItem = useCartStore((state) => state.addItem)
  const openCartSidebar = useCartSidebarStore((state) => state.open)
  const [quantity, setQuantity] = useState(1)
  const [substitutePreference, setSubstitutePreference] = useState<'closest_match' | 'do_not_substitute'>('closest_match')
  const [substituteProduct, setSubstituteProduct] = useState<SubstituteProduct | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [promotions, setPromotions] = useState<Promotion[]>([])

  const stockStatus = getStockStatus(product)

  // Parse images array
  const allImages: string[] = (() => {
    const imgs: string[] = []
    if (product.image_url) imgs.push(product.image_url)
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img: string) => {
        if (img && !imgs.includes(img)) imgs.push(img)
      })
    }
    return imgs
  })()

  // Fetch substitute product
  useEffect(() => {
    async function fetchSubstitute() {
      try {
        const res = await apiFetch(`/api/products/${product.id}/substitute`)
        if (res.ok) {
          const data = await res.json()
          setSubstituteProduct(data.substitute || null)
        }
      } catch {
        // silently fail
      }
    }
    fetchSubstitute()
  }, [product.id])

  // Fetch promotions for this product's category
  useEffect(() => {
    async function fetchPromotions() {
      try {
        const params = new URLSearchParams()
        if (product.category_id) params.set('categoryId', product.category_id)
        const res = await apiFetch(`/api/promotions?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setPromotions(data.promotions || [])
        }
      } catch {
        // silently fail
      }
    }
    fetchPromotions()
  }, [product.category_id])

  // Calculate discount percentage
  const discountPercent = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0

  const handleAddToCart = () => {
    addItem(product, quantity, substitutePreference)
    toast.success(`${product.name} added to cart`, {
      action: {
        label: 'View Cart',
        onClick: () => openCartSidebar(),
      },
    })
    setQuantity(1)
  }

  const handleAddSubstituteToCart = () => {
    if (!substituteProduct) return
    const subProduct: ProductWithCategory = {
      id: substituteProduct.id,
      store_id: product.store_id,
      category_id: substituteProduct.category.id,
      name: substituteProduct.name,
      slug: substituteProduct.slug,
      description: null,
      price: substituteProduct.price,
      original_price: null,
      vat_rate: 0,
      is_hfss: false,
      image_url: substituteProduct.imageUrl,
      images: null,
      barcode: null,
      brand: null,
      unit: 'each',
      weight_kg: null,
      is_available: substituteProduct.isAvailable,
      stock_quantity: substituteProduct.stockQuantity,
      is_featured: false,
      rating: 0,
      review_count: 0,
      sort_order: 0,
      created_at: '',
      updated_at: '',
      category: {
        id: substituteProduct.category.id,
        store_id: product.store_id,
        name: substituteProduct.category.name,
        slug: substituteProduct.category.slug,
        description: null,
        image_url: null,
        parent_id: null,
        sort_order: 0,
        is_active: true,
        created_at: '',
      },
    }
    addItem(subProduct, 1, 'closest_match')
    toast.success(`${substituteProduct.name} added to cart`)
  }

  const incrementQuantity = () => setQuantity((q) => q + 1)
  const decrementQuantity = () => setQuantity((q) => Math.max(1, q - 1))

  // Get complementary category IDs for "You Might Also Like"
  const complementaryCategoryIds = allCategories
    .filter((c) => c.id !== product.category_id)
    .slice(0, 3)
    .map((c) => c.id)

  return (
    <CustomerLayout storeName={store.name} store={store}>
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
          {/* ── LEFT: Image Gallery ── */}
          <div className="flex flex-col">
            <div className="flex gap-3">
              {/* Thumbnail Gallery (vertical) */}
              {allImages.length > 1 && (
                <div className="flex flex-col gap-2 w-12 sm:w-16 flex-shrink-0">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImageIndex === idx
                          ? 'border-[#f97316] shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Main Image Display */}
              <div className="flex-1 aspect-square bg-gray-50 rounded-xl relative flex items-center justify-center overflow-hidden border border-gray-200">
                {allImages.length > 0 ? (
                  <img
                    src={allImages[selectedImageIndex] || allImages[0]}
                    alt={product.name}
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <span className="text-6xl sm:text-8xl text-gray-300">
                    {categoryIcons[product.category?.slug || ''] || '🛒'}
                  </span>
                )}

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                  {product.is_hfss && (
                    <Badge className="bg-amber-500 text-white px-2.5 py-1 text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      HFSS
                    </Badge>
                  )}
                  {discountPercent > 0 && (
                    <Badge className="bg-red-500 text-white px-2.5 py-1 text-xs font-bold">
                      {discountPercent}% OFF
                    </Badge>
                  )}
                  {'is_age_restricted' in product && (product as Record<string, unknown>).is_age_restricted && (
                    <Badge className="bg-purple-600 text-white px-2.5 py-1 text-xs">
                      Challenge 25
                    </Badge>
                  )}
                </div>

                {/* Zoom hint */}
                {allImages.length > 0 && (
                  <div className="absolute bottom-3 right-3 text-gray-400">
                    <ZoomIn className="h-5 w-5" />
                  </div>
                )}
              </div>
            </div>

            {/* Quantity + Add To Cart */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Qty:</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-none hover:bg-gray-100"
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-semibold text-base border-x border-gray-200 h-10 flex items-center justify-center">
                    {quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-none hover:bg-gray-100"
                    onClick={incrementQuantity}
                    disabled={quantity >= product.stock_quantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-base h-12 rounded-xl"
                onClick={handleAddToCart}
                disabled={!stockStatus.available}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {!stockStatus.available
                  ? 'Out of Stock'
                  : `Add to Cart — ${formatPrice(product.price * quantity)}`}
              </Button>
            </div>
          </div>

          {/* ── RIGHT: Product Details ── */}
          <div className="flex flex-col">
            {/* Category Tag */}
            {product.category && (
              <Link
                href={`/catalog?category=${product.category.slug}`}
                className="text-sm font-medium text-[#16a34a] hover:underline mb-1.5 self-start"
              >
                {product.category.name}
              </Link>
            )}

            {/* Product Name */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {product.name}
            </h1>

            {/* Brand + Unit/Weight */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {product.brand && (
                <span className="text-sm font-medium text-gray-500">{product.brand}</span>
              )}
              {(product.unit || product.weight_kg) && (
                <>
                  {product.brand && <span className="text-gray-300">•</span>}
                  <span className="text-sm text-gray-500">
                    {product.weight_kg ? `${product.weight_kg}kg` : product.unit}
                  </span>
                </>
              )}
            </div>

            {/* Star Rating Badge */}
            {product.rating > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex items-center gap-0.5 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-bold text-yellow-700">{product.rating.toFixed(1)}</span>
                </div>
                {product.review_count > 0 && (
                  <span className="text-xs text-gray-400">({product.review_count} reviews)</span>
                )}
              </div>
            )}

            {/* Price Badge */}
            <div className="mt-4 flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg">
                <span className="text-xl sm:text-2xl font-bold">{formatPrice(product.price)}</span>
              </div>
              {product.original_price && product.original_price > product.price && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base sm:text-lg text-gray-400 line-through">{formatPrice(product.original_price)}</span>
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-xs font-semibold flex-shrink-0">
                    Save {formatPrice(product.original_price - product.price)}
                  </Badge>
                </div>
              )}
              <span className="text-xs sm:text-sm text-gray-500">per {product.unit}</span>
            </div>

            {/* Coupons & Offers */}
            {promotions.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-orange-500" />
                  Coupons & Offers
                </h3>
                {promotions.map((promo) => (
                  <div
                    key={promo.id}
                    className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg"
                  >
                    <Tag className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-orange-800">{promo.name}</p>
                      {promo.description && (
                        <p className="text-xs text-orange-600">{promo.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs flex-shrink-0">
                      {promo.discount_type === 'percentage'
                        ? `${promo.discount_value}% off`
                        : formatPrice(promo.discount_value)}
                    </Badge>
                    {promo.code && (
                      <code className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-mono">
                        {promo.code}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Stock Status */}
            <div className="mt-4 flex items-center gap-2">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${stockStatus.bgColor} ${stockStatus.color}`}>
                <div className={`h-2 w-2 rounded-full ${stockStatus.dotColor}`} />
                {stockStatus.label}
              </div>
              {stockStatus.available && product.stock_quantity <= 50 && (
                <span className="text-xs text-gray-400">
                  {product.stock_quantity} available
                </span>
              )}
            </div>

            {/* Trust Badges */}
            <div className="mt-4">
              <TrustBadges />
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

            {/* Substitute Product (when out of stock) */}
            {!stockStatus.available && substituteProduct && (
              <Card className="mt-4 border-[#16a34a] bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                      {substituteProduct.imageUrl ? (
                        <img src={substituteProduct.imageUrl} alt={substituteProduct.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#16a34a]">Recommended Alternative</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{substituteProduct.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-bold text-gray-900">{formatPrice(substituteProduct.price)}</span>
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                          In Stock
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#f97316] hover:bg-[#ea580c] text-white flex-shrink-0"
                      onClick={handleAddSubstituteToCart}
                    >
                      Add Instead
                    </Button>
                  </div>
                  <Link
                    href={`/product/${substituteProduct.slug}`}
                    className="inline-flex items-center gap-1 text-xs text-[#16a34a] hover:underline mt-2"
                  >
                    View details <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            )}

            <Separator className="my-5" />

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

            <Separator className="my-5" />

            {/* Delivery Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
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
            <div className="mt-5">
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
                {product.brand && (
                  <>
                    <div className="text-gray-500">Brand</div>
                    <div className="text-gray-900 font-medium">{product.brand}</div>
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

        {/* ── BOTTOM: Cross-Selling Engine ── */}
        <div className="mt-12 space-y-8">
          {/* Similar Products */}
          {product.category_id && (
            <CrossSellSection
              title="Similar Products"
              categoryId={product.category_id}
              excludeProductId={product.id}
              limit={10}
              storeId={store.id}
            />
          )}

          {/* You Might Also Like */}
          {complementaryCategoryIds.length > 0 && (
            <CrossSellSection
              title="You Might Also Like"
              complementaryCategoryIds={complementaryCategoryIds}
              excludeProductId={product.id}
              limit={10}
              storeId={store.id}
            />
          )}
        </div>
      </div>
    </CustomerLayout>
  )
}
