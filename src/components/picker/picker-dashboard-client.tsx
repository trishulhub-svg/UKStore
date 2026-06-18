'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  CheckCircle2,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-fetch'

interface Stats {
  bagsCompletedToday: number
  ordersToPack: number
}

interface ReadyOrder {
  id: string
  status: string
  total: number
  packedAt: string | null
  customerName: string
  itemCount: number
}

export function PickerDashboardClient() {
  const [stats, setStats] = useState<Stats>({ bagsCompletedToday: 0, ordersToPack: 0 })
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const ordersRes = await apiFetch('/api/picker/orders')

      if (ordersRes.ok) {
        const data = await ordersRes.json()
        setStats(data.stats || { bagsCompletedToday: 0, ordersToPack: 0 })
        setReadyOrders(data.readyOrders || [])
      }
    } catch (err) {
      console.error('Failed to fetch picker data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-28" />
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
            <ShoppingCart className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.ordersToPack}</p>
            <p className="text-[10px] text-gray-500 font-medium">To Pack</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 text-[#16a34a] mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.bagsCompletedToday}</p>
            <p className="text-[10px] text-gray-500 font-medium">Completed Today</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{readyOrders.length}</p>
            <p className="text-[10px] text-gray-500 font-medium">Ready for Pickup</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Quick Actions</h2>
        <Link href="/picker/packing">
          <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">Start Packing</p>
                  <p className="text-xs text-gray-500">{stats.ordersToPack} orders waiting</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Ready Orders */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Recently Packed</h2>
        {readyOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No packed orders yet today</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {readyOrders.slice(0, 5).map((order) => (
              <Card key={order.id} className="shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">
                      #{order.id.slice(-8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.customerName} · {order.itemCount} items · £{order.total.toFixed(2)}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Ready</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
