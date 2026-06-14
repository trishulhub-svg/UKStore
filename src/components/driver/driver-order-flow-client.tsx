'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  Circle,
  Package,
  Truck,
  MapPin,
  Phone,
  ArrowLeft,
  Camera,
  PenLine,
  AlertCircle,
} from 'lucide-react'

interface ProductInfo {
  id: string
  name: string
  imageUrl: string | null
  barcode: string | null
  category: { name: string } | null
}

interface OrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  picked: boolean
  product: ProductInfo | null
}

interface CustomerInfo {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface AddressInfo {
  id: string
  addressLine1: string
  addressLine2: string | null
  city: string
  postcode: string
}

interface Order {
  id: string
  status: string
  total: number
  deliveryFee: number
  subtotal: number
  notes: string | null
  createdAt: string
  customer: CustomerInfo
  address: AddressInfo
  items: OrderItem[]
}

const statusSteps = [
  { key: 'placed', label: 'Placed', icon: Package },
  { key: 'picking', label: 'Picking', icon: Package },
  { key: 'ready', label: 'Packed', icon: CheckCircle2 },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

export function DriverOrderFlowClient() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showConfirmDelivery, setShowConfirmDelivery] = useState(false)

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`)
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
  }, [fetchOrder])

  const handleMarkPicked = async (itemId: string) => {
    setActionLoading(itemId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, picked: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      }
    } catch (err) {
      console.error('Failed to mark as picked:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleClaimOrder = async () => {
    setActionLoading('claim')
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignToMe: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      }
    } catch (err) {
      console.error('Failed to claim order:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    setActionLoading(newStatus)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, assignToMe: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirmDelivery = async () => {
    setActionLoading('deliver')
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: null, signatureData: null }),
      })
      if (res.ok) {
        router.push('/driver')
      }
    } catch (err) {
      console.error('Failed to confirm delivery:', err)
    } finally {
      setActionLoading(null)
      setShowConfirmDelivery(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-24" />
        ))}
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">Order not found</p>
        <Button variant="outline" onClick={() => router.push('/driver')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const allPicked = order.items.every((item) => item.picked)
  const pickedCount = order.items.filter((item) => item.picked).length
  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status)

  return (
    <div className="p-4 space-y-4">
      {/* Back Button & Title */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/driver')} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-bold text-lg text-gray-900">Order #{order.id.slice(-8)}</h1>
          <p className="text-xs text-gray-500">
            {new Date(order.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Status Timeline */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {statusSteps.map((step, i) => {
              const isCompleted = i <= currentStepIndex
              const isCurrent = i === currentStepIndex
              const Icon = step.icon

              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                      isCompleted
                        ? 'bg-[#16a34a] text-white'
                        : 'bg-gray-100 text-gray-400'
                    } ${isCurrent ? 'ring-2 ring-[#16a34a]/30' : ''}`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={`text-[9px] text-center leading-tight ${
                      isCompleted ? 'text-[#16a34a] font-semibold' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {i < statusSteps.length - 1 && (
                    <div
                      className={`h-0.5 w-full mt-[-16px] mb-2 ${
                        i < currentStepIndex ? 'bg-[#16a34a]' : 'bg-gray-200'
                      }`}
                      style={{ position: 'relative', top: '-20px', zIndex: -1 }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Customer & Delivery Info */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700">Delivery Details</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-[#16a34a] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-gray-900">{order.address.addressLine1}</p>
              {order.address.addressLine2 && (
                <p className="text-sm text-gray-600">{order.address.addressLine2}</p>
              )}
              <p className="text-sm text-gray-600">{order.address.city} {order.address.postcode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#16a34a] shrink-0" />
            <span className="text-sm text-gray-900">{order.customer.name}</span>
            {order.customer.phone && (
              <span className="text-sm text-gray-500">· {order.customer.phone}</span>
            )}
          </div>
          {order.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
              <p className="text-xs font-medium text-amber-800">📝 Customer Note</p>
              <p className="text-xs text-amber-700">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claim Order Button (if not assigned) */}
      {order.status === 'picking' || order.status === 'ready' ? (
        <Button
          onClick={handleClaimOrder}
          disabled={actionLoading === 'claim'}
          className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white"
        >
          {actionLoading === 'claim' ? 'Claiming...' : 'Claim This Order'}
        </Button>
      ) : null}

      {/* Pick List */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700">Pick List</CardTitle>
            <Badge variant="outline" className="text-xs">
              {pickedCount}/{order.items.length} picked
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                item.picked
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <button
                onClick={() => !item.picked && handleMarkPicked(item.id)}
                disabled={item.picked || actionLoading === item.id}
                className="shrink-0"
              >
                {item.picked ? (
                  <CheckCircle2 className="h-6 w-6 text-[#16a34a]" />
                ) : (
                  <Circle className="h-6 w-6 text-gray-300 hover:text-[#16a34a] transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.picked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.productName}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Qty: {item.quantity}</span>
                  {item.product?.category && (
                    <>
                      <span>·</span>
                      <span>{item.product.category.name}</span>
                    </>
                  )}
                  {item.product?.barcode && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{item.product.barcode}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-gray-700">
                £{(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* When picking: show "Order Packed" when all items picked */}
        {order.status === 'picking' && allPicked && (
          <Button
            onClick={() => handleUpdateStatus('ready')}
            disabled={actionLoading === 'ready'}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-12 text-base"
          >
            <Package className="h-5 w-5 mr-2" />
            {actionLoading === 'ready' ? 'Updating...' : 'Mark Order as Packed'}
          </Button>
        )}

        {order.status === 'picking' && !allPicked && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">
              Pick all items to mark as packed ({pickedCount}/{order.items.length})
            </p>
          </div>
        )}

        {/* When ready: show "Start Delivery" */}
        {order.status === 'ready' && (
          <Button
            onClick={() => handleUpdateStatus('out_for_delivery')}
            disabled={actionLoading === 'out_for_delivery'}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-12 text-base"
          >
            <Truck className="h-5 w-5 mr-2" />
            {actionLoading === 'out_for_delivery' ? 'Starting...' : 'Start Delivery'}
          </Button>
        )}

        {/* When out for delivery: show "Confirm Delivery" */}
        {order.status === 'out_for_delivery' && !showConfirmDelivery && (
          <Button
            onClick={() => setShowConfirmDelivery(true)}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-12 text-base"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Confirm Delivery
          </Button>
        )}

        {/* Delivery Confirmation Dialog */}
        {showConfirmDelivery && (
          <Card className="shadow-sm border-[#16a34a]/20">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700">Confirm Delivery</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 text-gray-400 hover:border-[#16a34a] hover:text-[#16a34a] transition-colors cursor-pointer">
                  <Camera className="h-6 w-6" />
                  <span className="text-xs font-medium">Photo Proof</span>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center gap-2 text-gray-400 hover:border-[#16a34a] hover:text-[#16a34a] transition-colors cursor-pointer">
                  <PenLine className="h-6 w-6" />
                  <span className="text-xs font-medium">Signature</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Photo and signature are optional placeholders
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDelivery(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDelivery}
                  disabled={actionLoading === 'deliver'}
                  className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white"
                >
                  {actionLoading === 'deliver' ? 'Confirming...' : 'Confirm Delivered'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order delivered */}
        {order.status === 'delivered' && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-[#16a34a] mx-auto mb-2" />
            <p className="font-semibold text-gray-900">Order Delivered!</p>
            <Button variant="outline" onClick={() => router.push('/driver')} className="mt-3">
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
