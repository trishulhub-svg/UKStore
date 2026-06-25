'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, MapPin, Clock, Package, ShoppingBag, Truck, RotateCcw, AlertCircle, Receipt, X, ExternalLink, Mail } from 'lucide-react'
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
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)

  const handleViewReceipt = async () => {
    setReceiptOpen(true)
    setReceiptLoading(true)
    setReceiptHtml(null)
    try {
      const res = await fetch(`/api/orders/${order.id}/receipt?format=json`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setReceiptHtml(data.receiptHtml)
    } catch (err) {
      // silent fail — modal closes
      setReceiptOpen(false)
    } finally {
      setReceiptLoading(false)
    }
  }

  return (
    <CustomerLayout storeName={storeName}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Refund Alert Banner */}
        {order.payment_status === 'refunded' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-800">Order Refunded</h3>
                <p className="text-sm text-red-700 mt-1">
                  This order has been refunded. {formatPrice(order.total)} will be returned to your original payment method.
                  {order.status === 'cancelled' && ' The order has been cancelled.'}
                </p>
                {order.notes?.includes('[REFUND]') && (
                  <p className="text-xs text-red-600 mt-2">
                    Reason: {order.notes.split('[REFUND]')[1]?.split('.').slice(1, -1).join('.').trim() || 'Not specified'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cancelled Alert Banner */}
        {order.status === 'cancelled' && order.payment_status !== 'refunded' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800">Order Cancelled</h3>
                <p className="text-sm text-amber-700 mt-1">
                  This order has been cancelled. Please contact us if you have any questions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {order.payment_status !== 'refunded' && order.status !== 'cancelled' && (
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
        )}

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
                  <p className="font-medium text-sm capitalize">{order.status === 'cancelled' ? 'Cancelled' : order.status.replace(/_/g, ' ')}</p>
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

        {/* Receipt */}
        {order.receipt_number && (
          <Card className="mb-6">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-[#16a34a]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">Receipt</p>
                    <span className="font-mono text-xs text-gray-500">{order.receipt_number}</span>
                    {order.receipt_sent_at && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        <Mail className="h-3 w-3 mr-1" />
                        Emailed to you
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Keep this for your records. Click below to view or print.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewReceipt}
                    >
                      <Receipt className="h-4 w-4 mr-1.5" />
                      View Receipt
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`/api/orders/${order.id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1.5" />
                        Open / Print
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

      {/* Receipt Viewer Modal */}
      {receiptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60"
          onClick={() => setReceiptOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Receipt {order.receipt_number}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a
                    href={`/api/orders/${order.id}/receipt`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReceiptOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50">
              {receiptLoading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading receipt…</div>
              ) : receiptHtml ? (
                <div dangerouslySetInnerHTML={{ __html: receiptHtml }} />
              ) : (
                <div className="p-8 text-center text-sm text-gray-500">Receipt not available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  )
}
