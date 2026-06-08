'use client'

import Link from 'next/link'
import { CheckCircle2, MapPin, Clock, Package, ShoppingBag, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { formatPrice, getVatRateLabel } from '@/lib/vat'
import type { Order, OrderItem, Address } from '@/types'

interface OrderConfirmationClientProps {
  order: Order
  orderItems: OrderItem[]
  address: Address | null
  storeName?: string
}

const deliverySlotLabels: Record<string, string> = {
  'today-4-6': 'Today 4-6pm',
  'today-6-8': 'Today 6-8pm',
  'tomorrow-10-12': 'Tomorrow 10am-12pm',
  'tomorrow-12-2': 'Tomorrow 12-2pm',
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

export function OrderConfirmationClient({ order, orderItems, address, storeName }: OrderConfirmationClientProps) {
  const orderNumber = order.id.substring(0, 8).toUpperCase()

  return (
    <CustomerLayout storeName={storeName}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Success Banner */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#16a34a]/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9 text-[#16a34a]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Order Placed Successfully!</h1>
          <p className="text-gray-500 mt-2">Thank you for your order</p>
          <div className="mt-3">
            <Badge variant="secondary" className="text-sm font-mono px-3 py-1">
              Order #{orderNumber}
            </Badge>
          </div>
        </div>

        {/* Order Status Card */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-[#16a34a]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="font-medium text-sm capitalize">{order.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#16a34a]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Delivery Slot</p>
                  <p className="font-medium text-sm">
                    {deliverySlotLabels[order.delivery_slot || ''] || order.delivery_slot || 'TBD'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-[#16a34a]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Items</p>
                  <p className="font-medium text-sm">{orderItems.length} item{orderItems.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        {address && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#16a34a]" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                {address.address_line_1}
                {address.address_line_2 && `, ${address.address_line_2}`}
                <br />
                {address.city}, {address.postcode}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Order Items */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                      <span className="text-lg">🛒</span>
                    </div>
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-xs text-gray-500">
                        {formatPrice(item.unit_price)} × {item.quantity}
                        {item.substitute_preference === 'do_not_substitute' && (
                          <span className="ml-2 text-amber-600">• No substitutes</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="font-medium">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total Breakdown */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">VAT</span>
                <span>{formatPrice(order.vat_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery fee</span>
                <span>
                  {order.delivery_fee === 0 ? (
                    <span className="text-[#16a34a]">Free</span>
                  ) : (
                    formatPrice(order.delivery_fee)
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled
            title="Coming soon"
          >
            <Truck className="h-4 w-4 mr-2" />
            Track Order (Coming Soon)
          </Button>
          <Link href="/catalog" className="flex-1">
            <Button className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </CustomerLayout>
  )
}
