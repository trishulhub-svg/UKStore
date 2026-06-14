'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  CheckCircle2,
  ShoppingCart,
  Clock,
  MapPin,
  Phone,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'

interface OrderItem {
  id: string
  productName: string
  quantity: number
  picked: boolean
  product: {
    name: string
    imageUrl: string | null
    category: { name: string } | null
  } | null
}

interface Address {
  id: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  postcode: string
}

interface Order {
  id: string
  status: string
  total: number
  deliveryFee: number
  createdAt: string
  customer: { id: string; name: string; phone: string | null }
  address: Address
  items: OrderItem[]
}

interface Stats {
  completedToday: number
  completedThisWeek: number
  pickingCount: number
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
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export function DriverDashboardClient() {
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([])
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats>({ completedToday: 0, completedThisWeek: 0, pickingCount: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/driver/orders')
      if (res.ok) {
        const data = await res.json()
        setAssignedOrders(data.assignedOrders || [])
        setAvailableOrders(data.availableOrders || [])
        setStats(data.stats || { completedToday: 0, completedThisWeek: 0, pickingCount: 0 })
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const handleClaimOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignToMe: true }),
      })
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Failed to claim order:', err)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-[#16a34a] mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.completedToday}</p>
            <p className="text-[10px] text-gray-500 font-medium">Today</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ShoppingCart className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.pickingCount}</p>
            <p className="text-[10px] text-gray-500 font-medium">Picking</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.completedThisWeek}</p>
            <p className="text-[10px] text-gray-500 font-medium">This Week</p>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">My Orders</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-8 text-gray-500"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {assignedOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No assigned orders</p>
              <p className="text-xs text-gray-400">Check available orders below</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assignedOrders.map((order) => (
              <Link key={order.id} href={`/driver/orders/${order.id}`}>
                <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-[#16a34a]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          #{order.id.slice(-8)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''} · £{order.total.toFixed(2)}
                        </p>
                      </div>
                      <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{order.address.addressLine1}, {order.address.postcode}</span>
                    </div>
                    {order.customer.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Phone className="h-3 w-3" />
                        <span>{order.customer.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(order.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Available Orders */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Available Orders</h2>

        {availableOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No available orders right now</p>
              <p className="text-xs text-gray-400">New orders will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {availableOrders.map((order) => (
              <Card key={order.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">
                        #{order.id.slice(-8)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''} · £{order.total.toFixed(2)}
                      </p>
                    </div>
                    <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                      {statusLabels[order.status] || order.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{order.address.addressLine1}, {order.address.postcode}</span>
                  </div>
                  <Button
                    onClick={() => handleClaimOrder(order.id)}
                    className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white text-sm h-10"
                  >
                    Claim Order
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
