'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Package,
  CheckCircle2,
  Circle,
  Truck,
  MapPin,
  Clock,
  User,
  ArrowLeft,
  ShoppingBag,
  Navigation,
} from 'lucide-react'

interface DriverInfo {
  id: string
  name: string
  driverProfile: { vehicleType: string | null; vehicleReg: string | null } | null
}

interface ProductInfo {
  id: string
  name: string
  imageUrl: string | null
  slug: string
  price: number
  category: { name: string } | null
}

interface OrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
  picked: boolean
  product: ProductInfo | null
}

interface AddressInfo {
  addressLine1: string
  addressLine2: string | null
  city: string
  postcode: string
}

interface OrderDetail {
  id: string
  status: string
  total: number
  subtotal: number
  deliveryFee: number
  vatAmount: number
  notes: string | null
  createdAt: string
  updatedAt: string
  driver: DriverInfo | null
  address: AddressInfo
  items: OrderItem[]
  store: { name: string }
}

const statusSteps = [
  { key: 'placed', label: 'Order Placed', description: 'Your order has been received', icon: ShoppingBag },
  { key: 'picking', label: 'Being Picked', description: 'A driver is picking your items', icon: Package },
  { key: 'ready', label: 'Packed & Ready', description: 'Your order is packed and ready', icon: CheckCircle2 },
  { key: 'out_for_delivery', label: 'Out for Delivery', description: 'Your order is on its way', icon: Truck },
  { key: 'delivered', label: 'Delivered', description: 'Your order has been delivered', icon: CheckCircle2 },
]

export function OrderTrackingClient() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      }
    } catch (err) {
      console.error('Failed to fetch order:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
    const interval = setInterval(fetchOrder, 15000)
    return () => clearInterval(interval)
  }, [fetchOrder])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="animate-pulse bg-gray-200 rounded-xl h-48" />
        <div className="animate-pulse bg-gray-200 rounded-xl h-32" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto p-4 text-center">
        <p className="text-gray-600">Order not found</p>
        <Button variant="outline" onClick={() => router.push('/orders')} className="mt-4">
          Back to Orders
        </Button>
      </div>
    )
  }

  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status)
  const isCancelled = order.status === 'cancelled'

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/orders')} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Order #{order.id.slice(-8)}</h1>
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <Badge className={
          isCancelled
            ? 'bg-red-100 text-red-800'
            : order.status === 'delivered'
            ? 'bg-green-100 text-green-800'
            : 'bg-blue-100 text-blue-800'
        }>
          {isCancelled ? 'Cancelled' : statusSteps[currentStepIndex]?.label || order.status}
        </Badge>
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-0">
              {statusSteps.map((step, i) => {
                const isCompleted = i <= currentStepIndex
                const isCurrent = i === currentStepIndex
                const Icon = step.icon

                return (
                  <div key={step.key} className="flex gap-3">
                    {/* Timeline line & dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? 'bg-[#16a34a] text-white'
                            : 'bg-gray-100 text-gray-400'
                        } ${isCurrent ? 'ring-4 ring-[#16a34a]/10' : ''}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {i < statusSteps.length - 1 && (
                        <div
                          className={`w-0.5 h-8 ${
                            i < currentStepIndex ? 'bg-[#16a34a]' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="pb-4">
                      <p className={`text-sm font-medium ${
                        isCompleted ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                      <p className={`text-xs ${
                        isCompleted ? 'text-gray-500' : 'text-gray-300'
                      }`}>
                        {step.description}
                      </p>
                      {isCurrent && step.key === 'out_for_delivery' && (
                        <p className="text-xs text-[#16a34a] font-medium mt-1 flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          Live tracking coming soon
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancelled State */}
      {isCancelled && (
        <Card className="shadow-sm border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 text-red-400 mx-auto mb-2" />
            <p className="font-semibold text-red-800">This order was cancelled</p>
          </CardContent>
        </Card>
      )}

      {/* Driver Info */}
      {order.driver && (order.status === 'out_for_delivery' || order.status === 'ready' || order.status === 'delivered') && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {order.status === 'delivered' ? 'Delivered by' : 'Your Driver'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                <User className="h-5 w-5 text-[#16a34a]" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">{order.driver.name}</p>
                {order.driver.driverProfile && (
                  <p className="text-xs text-gray-500">
                    {order.driver.driverProfile.vehicleType
                      ? `${order.driver.driverProfile.vehicleType.charAt(0).toUpperCase() + order.driver.driverProfile.vehicleType.slice(1)}`
                      : 'Driver'}
                    {order.driver.driverProfile.vehicleReg && (
                      <span className="ml-1 uppercase">({order.driver.driverProfile.vehicleReg})</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Address */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Delivery Address
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-sm text-gray-900">{order.address.addressLine1}</p>
          {order.address.addressLine2 && (
            <p className="text-sm text-gray-600">{order.address.addressLine2}</p>
          )}
          <p className="text-sm text-gray-600">{order.address.city} {order.address.postcode}</p>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Order Items ({order.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                {item.picked && <CheckCircle2 className="h-3.5 w-3.5 text-[#16a34a]" />}
                <div>
                  <p className="text-sm text-gray-900">{item.productName}</p>
                  <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-700">£{item.subtotal.toFixed(2)}</p>
            </div>
          ))}

          <Separator className="my-2" />

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">£{order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">VAT</span>
              <span className="text-gray-700">£{order.vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Delivery</span>
              <span className="text-gray-700">£{order.deliveryFee.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-[#16a34a]">£{order.total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map placeholder */}
      {(order.status === 'out_for_delivery' || order.status === 'ready') && (
        <Card className="shadow-sm border-dashed">
          <CardContent className="p-6 text-center">
            <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">Live Map Tracking</p>
            <p className="text-xs text-gray-400">Coming soon — track your driver in real time</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
