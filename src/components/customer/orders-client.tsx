'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ShoppingBag,
  ArrowLeft,
  RotateCcw,
  ChevronRight,
  Package,
  Clock,
  MapPin,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'

interface OrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  product: { name: string; imageUrl: string | null } | null
}

interface Order {
  id: string
  status: string
  total: number
  deliveryFee: number
  createdAt: string
  // ISO timestamp set by admin/driver when assigning a driver.
  estimatedDeliveryAt: string | null
  items: OrderItem[]
  driver: { id: string; name: string } | null
  address: { addressLine1: string; postcode: string }
}

const statusColors: Record<string, string> = {
  placed: 'bg-blue-100 text-blue-800',
  picking: 'bg-amber-100 text-amber-800',
  ready: 'bg-green-100 text-green-800',
  out_for_delivery: 'bg-purple-100 text-purple-800',
  delivered: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  placed: 'Placed',
  picking: 'Picking',
  ready: 'Packed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export function OrdersClient() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [reorderLoading, setReorderLoading] = useState<string | null>(null)

  const fetchOrders = async (status = '') => {
    try {
      const url = status ? `/api/user/orders?status=${status}` : '/api/user/orders'
      const res = await apiFetch(url)
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders(activeFilter === 'all' ? '' : activeFilter)
  }, [activeFilter])

  const handleReorder = async (e: React.MouseEvent, orderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setReorderLoading(orderId)
    try {
      const res = await apiFetch(`/api/user/orders/${orderId}/reorder`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        // Add items to cart using cart store
        const { useCartStore } = await import('@/stores/cart-store')
        const store = useCartStore.getState()

        for (const item of data.items) {
          const product = {
            id: item.product.id,
            store_id: '',
            category_id: '',
            name: item.product.name,
            slug: item.product.slug,
            description: null,
            price: item.product.price,
            vat_rate: item.product.vatRate ?? 0,
            is_hfss: false,
            image_url: item.product.imageUrl,
            barcode: null,
            unit: item.product.unit ?? 'each',
            weight_kg: null,
            is_available: true,
            stock_quantity: 100,
            is_featured: false,
            original_price: null,
            images: null,
            brand: null,
            rating: 0,
            review_count: 0,
            sort_order: 0,
            created_at: '',
            updated_at: '',
            category: item.product.category
              ? { id: '', store_id: '', name: item.product.category.name, slug: item.product.category.slug, description: null, image_url: null, parent_id: null, sort_order: 0, is_active: true, created_at: '' }
              : undefined,
          }
          store.addItem(product, item.quantity)
        }
        router.push('/cart')
      }
    } catch (err) {
      console.error('Failed to reorder:', err)
    } finally {
      setReorderLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
          <p className="text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeFilter} onValueChange={setActiveFilter}>
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          <TabsTrigger value="placed" className="flex-1">Placed</TabsTrigger>
          <TabsTrigger value="out_for_delivery" className="flex-1">Active</TabsTrigger>
          <TabsTrigger value="delivered" className="flex-1">Done</TabsTrigger>
        </TabsList>

        <TabsContent value={activeFilter} className="mt-3">
          {orders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-600">No orders found</p>
                <p className="text-sm text-gray-400 mt-1">Your order history will appear here</p>
                <Link href="/catalog">
                  <Button className="mt-4 bg-[#16a34a] hover:bg-[#15803d] text-white">
                    Start Shopping
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Link href={`/orders/${order.id}/track`} className="font-semibold text-sm text-gray-900 hover:text-[#16a34a]">
                          #{order.id.slice(-8)}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>

                    {/* Items preview */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                      <Package className="h-3 w-3" />
                      <span>
                        {order.items.slice(0, 3).map((i) => i.productName).join(', ')}
                        {order.items.length > 3 && ` +${order.items.length - 3} more`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                      <MapPin className="h-3 w-3" />
                      <span>{order.address.addressLine1}, {order.address.postcode}</span>
                    </div>

                    {/* ETA badge — shown only while the order is en route */}
                    {order.estimatedDeliveryAt &&
                      ['ready', 'out_for_delivery'].includes(order.status) &&
                      (() => {
                        const eta = new Date(order.estimatedDeliveryAt)
                        const mins = Math.round((eta.getTime() - Date.now()) / 60_000)
                        const isSameDay = eta.toDateString() === new Date().toDateString()
                        const timeStr = eta.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
                        const label = isSameDay && mins > 0 && mins <= 90
                          ? `Will be delivered in ~${mins} min`
                          : isSameDay
                            ? `Will be delivered by ${timeStr}`
                            : `Will be delivered ${eta.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} by ${timeStr}`
                        return (
                          <div className="flex items-center gap-1.5 text-xs text-[#15803d] bg-[#16a34a]/10 rounded-md px-2 py-1 mb-2 w-fit">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">{label}</span>
                          </div>
                        )
                      })()}

                    <div className="flex items-center justify-between">
                      <p className="font-bold text-gray-900">£{order.total.toFixed(2)}</p>
                      <div className="flex items-center gap-2">
                        {order.status === 'delivered' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleReorder(e, order.id)}
                            disabled={reorderLoading === order.id}
                            className="h-9 min-h-[36px] text-xs border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            {reorderLoading === order.id ? 'Adding...' : 'Reorder'}
                          </Button>
                        )}
                        <Link href={`/orders/${order.id}/track`}>
                          <Button variant="ghost" size="sm" className="h-9 min-h-[36px] text-xs text-gray-500">
                            View
                            <ChevronRight className="h-3 w-3 ml-0.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
