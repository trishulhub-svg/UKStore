'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Minus, Plus, Tag, Clock, ShoppingBag, Trash2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useCartStore } from '@/store/cart'
import { useCartSidebarStore } from '@/stores/cart-sidebar-store'
import { formatPrice } from '@/lib/vat'
import { calculateDeliveryFee } from '@/lib/delivery'
import { useDeliveryLocation } from '@/lib/delivery-location'
import type { Store } from '@/types'

interface CartSidebarProps {
  store?: Store | null
}

export function CartSidebar({ store }: CartSidebarProps) {
  const { isOpen, close } = useCartSidebarStore()
  const items = useCartStore((state) => state.items)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const getTotalPrice = useCartStore((state) => state.getTotalPrice)
  const getTotalItems = useCartStore((state) => state.getTotalItems)
  const deliveryLocation = useDeliveryLocation()

  const [promoCode, setPromoCode] = useState('')
  const [promoType, setPromoType] = useState<'none' | 'fresh5' | 'save2'>('none')

  // Calculate savings from original prices
  const totalSavings = items.reduce((total, item) => {
    if (item.product.original_price && item.product.original_price > item.product.price) {
      return total + (item.product.original_price - item.product.price) * item.quantity
    }
    return total
  }, 0)

  const itemTotal = getTotalPrice()
  const totalItems = getTotalItems()

  // Calculate promo discount (derived, not in effect)
  const promoDiscount = promoType === 'fresh5'
    ? Number((itemTotal * 0.05).toFixed(2))
    : promoType === 'save2'
      ? 2.0
      : 0
  const promoApplied = promoType !== 'none'

  // Delivery fee calculation — use real distance from delivery location context
  const distanceKm = deliveryLocation.location.distanceKm
  const isWithinZone = deliveryLocation.location.isWithinDeliveryZone
  const hasLocation = deliveryLocation.location.latitude !== null && deliveryLocation.location.longitude !== null

  // Use the proper delivery fee engine
  const deliveryPricing = store && distanceKm !== null
    ? calculateDeliveryFee({
        base_delivery_fee: store.base_delivery_fee,
        per_km_charge: store.per_km_charge,
        free_delivery_threshold: store.free_delivery_threshold,
        delivery_radius_km: store.delivery_radius_km,
        order_subtotal: itemTotal,
        distance_km: distanceKm,
      })
    : null

  // If we have real distance data, use it; otherwise fall back to base fee only
  const deliveryFee = deliveryPricing
    ? deliveryPricing.delivery_fee
    : (itemTotal >= (store?.free_delivery_threshold ?? Infinity) ? 0 : (store?.base_delivery_fee ?? 0))
  const isFreeDelivery = deliveryPricing ? deliveryPricing.is_free_delivery : (itemTotal >= (store?.free_delivery_threshold ?? Infinity))
  const amountForFreeDelivery = isFreeDelivery ? 0 : (store?.free_delivery_threshold ?? 0) - itemTotal

  const discountAmount = promoApplied ? promoDiscount : 0
  const finalTotal = itemTotal + deliveryFee - discountAmount

  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === 'FRESH5') {
      setPromoType('fresh5')
    } else if (promoCode.toUpperCase() === 'SAVE2') {
      setPromoType('save2')
    } else {
      setPromoType('none')
    }
  }

  const handleRemovePromo = () => {
    setPromoType('none')
    setPromoCode('')
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[400px] p-0 flex flex-col h-full"
      >
        <SheetHeader className="p-4 pb-2 flex flex-row items-center gap-2 space-y-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={close}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <SheetTitle className="text-lg font-bold">Your Cart</SheetTitle>
          <span className="text-sm text-gray-500 ml-auto">{totalItems} items</span>
        </SheetHeader>
        <SheetDescription className="sr-only">Shopping cart sidebar</SheetDescription>

        {/* Savings Bar */}
        {totalSavings > 0 && (
          <div className="mx-4 mb-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Tag className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-green-700">
              You&apos;re saving {formatPrice(totalSavings)}!
            </span>
          </div>
        )}

        {/* Coupons Section */}
        <div className="mx-4 mb-3">
          {promoApplied ? (
            <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-700">{promoCode.toUpperCase()} applied</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-orange-600 hover:text-orange-800 h-6 px-2"
                onClick={handleRemovePromo}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50 h-9"
                onClick={handleApplyPromo}
                disabled={!promoCode.trim()}
              >
                Apply
              </Button>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-4 min-h-0">
          {/* Delivery Info */}
          <div className="flex items-center gap-2 mb-3 px-1">
            {hasLocation && distanceKm !== null ? (
              isWithinZone ? (
                <>
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">
                    {distanceKm}km away — Delivery available
                  </span>
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-500">
                    {distanceKm}km away — Outside delivery zone
                  </span>
                </>
              )
            ) : (
              <>
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-600">Same-Day Delivery</span>
              </>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ShoppingBag className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium text-gray-500">Your cart is empty</p>
              <p className="text-xs text-gray-400 mt-1">Add items to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  {/* Product Image */}
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-white border border-gray-200 flex-shrink-0 flex items-center justify-center">
                    {item.product.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="h-4 w-4 text-gray-300" />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.product.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-bold text-gray-900">
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                      {item.quantity > 1 && (
                        <span className="text-xs text-gray-400">
                          ({formatPrice(item.product.price)} each)
                        </span>
                      )}
                    </div>
                    {item.product.original_price && item.product.original_price > item.product.price && (
                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(item.product.original_price * item.quantity)}
                      </span>
                    )}
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (item.quantity <= 1) {
                          removeItem(item.product.id)
                        } else {
                          updateQuantity(item.product.id, item.quantity - 1)
                        }
                      }}
                    >
                      {item.quantity <= 1 ? (
                        <Trash2 className="h-3 w-3 text-red-500" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                    </Button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add More Link */}
          {items.length > 0 && (
            <Link
              href="/catalog"
              onClick={close}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#16a34a] hover:underline mt-4 mb-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Add More Items
            </Link>
          )}
        </div>

        {/* Bill Summary & Checkout — fixed at bottom */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 bg-white">
            <div className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Bill Summary</h3>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Item Total</span>
                <span className="font-medium text-gray-900">{formatPrice(itemTotal)}</span>
              </div>

              {/* Delivery zone warning */}
              {hasLocation && !isWithinZone && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 font-medium">
                  Your location is outside our delivery zone ({store?.delivery_radius_km ?? 5}km radius). Please update your delivery address.
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Delivery Fee
                  {distanceKm !== null && hasLocation && !isFreeDelivery && (
                    <span className="text-gray-400 ml-1">
                      ({distanceKm}km x {formatPrice(store?.per_km_charge ?? 0)})
                    </span>
                  )}
                </span>
                {isFreeDelivery ? (
                  <span className="font-medium text-green-600">FREE</span>
                ) : (
                  <span className="font-medium text-gray-900">{formatPrice(deliveryFee)}</span>
                )}
              </div>

              {!isFreeDelivery && amountForFreeDelivery > 0 && (
                <p className="text-xs text-orange-600 font-medium">
                  Add {formatPrice(amountForFreeDelivery)} more for free delivery
                </p>
              )}

              {promoApplied && discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Discount</span>
                  <span className="font-medium text-green-600">-{formatPrice(discountAmount)}</span>
                </div>
              )}

              <Separator className="my-1" />

              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-gray-900">To Pay</span>
                <span className="text-base font-bold text-gray-900">{formatPrice(Math.max(0, finalTotal))}</span>
              </div>
            </div>

            {/* Proceed to Pay Button */}
            <div className="px-4 pb-4">
              {hasLocation && !isWithinZone ? (
                <Button
                  className="w-full h-12 text-base font-bold bg-gray-300 text-gray-500 cursor-not-allowed rounded-xl"
                  disabled
                >
                  Outside Delivery Zone
                </Button>
              ) : (
                <Link href="/checkout" onClick={close} className="block">
                  <Button className="w-full h-12 text-base font-bold bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl">
                    Proceed to Pay — {formatPrice(Math.max(0, finalTotal))}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
