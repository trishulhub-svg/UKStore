'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Package,
  CheckCircle2,
  Circle,
  ShoppingCart,
  ArrowRight,
  RefreshCw,
  MapPin,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-fetch'

interface OrderItem {
  id: string
  productName: string
  quantity: number
  picked: boolean
  aisle: string | null
  product: {
    name: string
    imageUrl: string | null
    category: string | null
  } | null
}

interface PickerOrder {
  id: string
  status: string
  total: number
  createdAt: string
  customerName: string
  items: OrderItem[]
}

type KanbanColumn = 'new' | 'packing' | 'ready'

const statusLabels: Record<string, string> = {
  placed: 'New',
  picking: 'Packing',
  ready: 'Ready',
}

const statusColors: Record<string, string> = {
  placed: 'bg-blue-100 text-blue-800',
  picking: 'bg-amber-100 text-amber-800',
  ready: 'bg-green-100 text-green-800',
}

export function PickerPackingClient() {
  const [orders, setOrders] = useState<PickerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<KanbanColumn>('new')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/picker/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const handleTogglePicked = async (orderId: string, itemId: string, currentPicked: boolean) => {
    setActionLoading(itemId)
    try {
      const res = await apiFetch(`/api/picker/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, picked: !currentPicked }),
      })
      if (res.ok) {
        const data = await res.json()
        // Refresh orders
        await fetchData()
      }
    } catch (err) {
      console.error('Failed to toggle picked:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkPacked = async (orderId: string) => {
    setActionLoading(orderId)
    try {
      const res = await apiFetch(`/api/picker/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markPacked: true }),
      })
      if (res.ok) {
        await fetchData()
      } else {
        const data = await res.json()
        console.error('Failed to mark as packed:', data.error)
      }
    } catch (err) {
      console.error('Failed to mark as packed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Categorize orders into kanban columns
  const newOrders = orders.filter((o) => o.status === 'placed')
  const packingOrders = orders.filter((o) => o.status === 'picking')
  // Ready orders are no longer in the "to pack" list but we show them as completed

  const getActiveOrders = (): PickerOrder[] => {
    switch (activeTab) {
      case 'new': return newOrders
      case 'packing': return packingOrders
      default: return []
    }
  }

  // Sort items by aisle for the aisle-optimized checklist
  const sortByAisle = (items: OrderItem[]): OrderItem[] => {
    return [...items].sort((a, b) => {
      const aisleA = a.aisle || 'ZZ'
      const aisleB = b.aisle || 'ZZ'
      return aisleA.localeCompare(aisleB)
    })
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-40" />
        ))}
      </div>
    )
  }

  const activeOrders = getActiveOrders()

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Packing</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 text-gray-500"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Kanban Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('new')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'new'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          New
          {newOrders.length > 0 && (
            <Badge className="ml-1 bg-white/20 text-current" variant="secondary">
              {newOrders.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('packing')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'packing'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Package className="h-4 w-4" />
          Packing
          {packingOrders.length > 0 && (
            <Badge className="ml-1 bg-white/20 text-current" variant="secondary">
              {packingOrders.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('ready')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'ready'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Ready
        </button>
      </div>

      {/* Order Cards */}
      {activeTab === 'ready' ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Packed orders move to &quot;Ready&quot; status</p>
            <p className="text-xs text-gray-400">They are now waiting for a driver to pick up</p>
          </CardContent>
        </Card>
      ) : activeOrders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No {activeTab === 'new' ? 'new' : 'packing'} orders right now
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeOrders.map((order) => {
            const sortedItems = sortByAisle(order.items)
            const pickedCount = order.items.filter((i) => i.picked).length
            const allPicked = order.items.every((i) => i.picked)

            return (
              <Card key={order.id} className="shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold text-gray-700">
                        Order #{order.id.slice(-8)}
                      </CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {order.customerName} · {order.items.length} items · £{order.total.toFixed(2)}
                      </p>
                    </div>
                    <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                      {statusLabels[order.status] || order.status}
                    </Badge>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{pickedCount}/{order.items.length} picked</span>
                      <span>{Math.round((pickedCount / order.items.length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-[#16a34a] h-1.5 rounded-full transition-all"
                        style={{ width: `${(pickedCount / order.items.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {/* Aisle-Optimized Checklist */}
                  <div className="space-y-1">
                    {sortedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          item.picked
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <Checkbox
                          checked={item.picked}
                          onCheckedChange={() =>
                            handleTogglePicked(order.id, item.id, item.picked)
                          }
                          disabled={actionLoading === item.id}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            item.picked ? 'line-through text-gray-400' : 'text-gray-900'
                          }`}>
                            {item.productName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Qty: {item.quantity}</span>
                            {item.product?.category && (
                              <>
                                <span>·</span>
                                <span>{item.product.category}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {item.aisle && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            <MapPin className="h-2.5 w-2.5 mr-0.5" />
                            {item.aisle}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Mark as Packed Button */}
                  {order.status === 'picking' && allPicked && (
                    <>
                      <Separator className="my-3" />
                      <Button
                        onClick={() => handleMarkPacked(order.id)}
                        disabled={actionLoading === order.id}
                        className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 text-sm font-medium"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {actionLoading === order.id ? 'Marking...' : 'Mark Order as Packed'}
                      </Button>
                    </>
                  )}

                  {order.status === 'picking' && !allPicked && (
                    <div className="text-center mt-3">
                      <p className="text-xs text-gray-500">
                        Pick all items to mark as packed ({pickedCount}/{order.items.length})
                      </p>
                    </div>
                  )}

                  {order.status === 'placed' && (
                    <div className="text-center mt-3">
                      <p className="text-xs text-gray-500">
                        Start picking items to begin packing
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
