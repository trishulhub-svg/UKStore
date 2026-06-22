'use client'

import Link from 'next/link'
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft, ShoppingBag, SwitchCamera, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { useCartStore } from '@/store/cart'
import { formatPrice, getVatRateLabel, calculateVatFromGross } from '@/lib/vat'
import { calculateDeliveryFee } from '@/lib/delivery'
import { useDeliveryLocation } from '@/lib/delivery-location'
import type { Store } from '@/types'

interface CartClientProps {
  store: Store
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

export function CartClient({ store }: CartClientProps) {
  const items = useCartStore((state) => state.items)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const updateSubstitutePreference = useCartStore((state) => state.updateSubstitutePreference)
  const clearCart = useCartStore((state) => state.clearCart)

  // Calculate totals
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0)

  // Group VAT by rate
  const vatGroups: Record<number, { gross: number; vat: number; label: string }> = {}
  items.forEach((item) => {
    const rate = item.product.vat_rate
    const itemGross = item.product.price * item.quantity
    const itemVat = calculateVatFromGross(itemGross, rate)

    if (!vatGroups[rate]) {
      vatGroups[rate] = { gross: 0, vat: 0, label: getVatRateLabel(rate) }
    }
    vatGroups[rate].gross += itemGross
    vatGroups[rate].vat += itemVat
  })

  const totalVat = Object.values(vatGroups).reduce((sum, group) => sum + group.vat, 0)

  // Delivery fee calculation using real distance from delivery location context
  const deliveryLocation = useDeliveryLocation()
  const distanceKm = deliveryLocation.location.distanceKm
  const isWithinZone = deliveryLocation.location.isWithinDeliveryZone
  const hasLocation = deliveryLocation.location.latitude !== null && deliveryLocation.location.longitude !== null

  const deliveryPricing = distanceKm !== null
    ? calculateDeliveryFee({
        base_delivery_fee: store.base_delivery_fee,
        per_km_charge: store.per_km_charge,
        free_delivery_threshold: store.free_delivery_threshold,
        delivery_radius_km: store.delivery_radius_km,
        order_subtotal: subtotal,
        distance_km: distanceKm,
      })
    : null

  const deliveryFee = deliveryPricing
    ? deliveryPricing.delivery_fee
    : (subtotal >= store.free_delivery_threshold ? 0 : store.base_delivery_fee)
  const isFreeDelivery = deliveryPricing ? deliveryPricing.is_free_delivery : (subtotal >= store.free_delivery_threshold)
  const total = subtotal + deliveryFee

  // Empty cart state
  if (items.length === 0) {
    return (
      <CustomerLayout storeName={store.name} store={store}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-16">
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="h-10 w-10 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Cart is Empty</h1>
            <p className="text-gray-500 mb-6">
              Looks like you haven&apos;t added anything to your cart yet. Start browsing our fresh groceries!
            </p>
            <Link href="/catalog">
              <Button size="lg" className="bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold">
                <ShoppingBag className="h-5 w-5 mr-2" />
                Start Shopping
              </Button>
            </Link>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout storeName={store.name} store={store}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Your Cart</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} item{items.length !== 1 ? 's' : ''} in your cart
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <Card key={item.product.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Product Image Placeholder */}
                    <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                      {item.product.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-2xl sm:text-3xl text-gray-400">
                          {categoryIcons[item.product.category?.slug || ''] || '🛒'}
                        </span>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            href={`/product/${item.product.slug}`}
                            className="font-medium text-gray-900 hover:text-[#16a34a] transition-colors text-sm sm:text-base line-clamp-2"
                          >
                            {item.product.name}
                          </Link>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.product.category?.name} • {formatPrice(item.product.price)} per {item.product.unit}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 h-10 w-10 text-gray-400 hover:text-red-500"
                          onClick={() => removeItem(item.product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="font-bold text-gray-900">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>

                      {/* Substitute Preference */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                        <Switch
                          id={`sub-${item.product.id}`}
                          checked={item.substitute_preference === 'do_not_substitute'}
                          onCheckedChange={(checked) =>
                            updateSubstitutePreference(
                              item.product.id,
                              checked ? 'do_not_substitute' : 'closest_match'
                            )
                          }
                          className="scale-75 origin-left"
                        />
                        <Label
                          htmlFor={`sub-${item.product.id}`}
                          className="text-xs text-gray-500 cursor-pointer"
                        >
                          <SwitchCamera className="h-3 w-3 inline mr-1" />
                          {item.substitute_preference === 'do_not_substitute'
                            ? 'No substitutes'
                            : 'Allow substitutes'}
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Clear Cart */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={clearCart}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear Cart
              </Button>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Delivery Zone Warning */}
                {hasLocation && !isWithinZone && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-red-600 font-medium">Outside delivery zone</p>
                      <p className="text-xs text-red-500 mt-0.5">Your location is {distanceKm}km away — we deliver within {store.delivery_radius_km}km.</p>
                    </div>
                  </div>
                )}

                {/* Distance Info */}
                {hasLocation && distanceKm !== null && isWithinZone && !isFreeDelivery && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-600 font-medium">
                      📍 {distanceKm}km from store — Delivery: {formatPrice(store.base_delivery_fee)} + {formatPrice(store.per_km_charge)}/km
                    </p>
                  </div>
                )}

                {/* Subtotal */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>

                {/* VAT Breakdown */}
                {Object.entries(vatGroups).map(([rate, group]) => (
                  <div key={rate} className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {group.label} VAT
                    </span>
                    <span className="text-gray-600">{formatPrice(group.vat)}</span>
                  </div>
                ))}

                {/* Delivery Fee */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Delivery fee
                    {hasLocation && distanceKm !== null && !isFreeDelivery && (
                      <span className="text-gray-400 ml-1">({distanceKm}km)</span>
                    )}
                  </span>
                  <span className="font-medium">
                    {isFreeDelivery ? (
                      <span className="text-[#16a34a]">Free</span>
                    ) : (
                      formatPrice(deliveryFee)
                    )}
                  </span>
                </div>

                {/* Free Delivery Threshold Notice */}
                {!isFreeDelivery && (
                  <div className="bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-[#16a34a] font-medium">
                      🚚 Free delivery on orders over {formatPrice(store.free_delivery_threshold)}!
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Add {formatPrice(store.free_delivery_threshold - subtotal)} more to qualify
                    </p>
                  </div>
                )}

                <Separator />

                {/* Total */}
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>

                {totalVat > 0 && (
                  <p className="text-xs text-gray-400">
                    Includes {formatPrice(totalVat)} VAT
                  </p>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  {hasLocation && !isWithinZone ? (
                    <Button className="w-full bg-gray-300 text-gray-500 cursor-not-allowed" disabled>
                      Outside Delivery Zone
                    </Button>
                  ) : (
                    <Link href="/checkout" className="block">
                      <Button className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold h-11">
                        Proceed to Checkout
                      </Button>
                    </Link>
                  )}
                  <Link href="/catalog" className="block">
                    <Button variant="outline" className="w-full h-11">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CustomerLayout>
  )
}
