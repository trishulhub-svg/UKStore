'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PoundSterling, TrendingUp, Calendar, Package } from 'lucide-react'

interface DeliveryOrder {
  id: string
  deliveryFee: number
  total: number
  updatedAt: string
  customer: { name: string }
  address: { addressLine1: string; postcode: string }
}

interface EarningsPeriod {
  deliveries: number
  earnings: number
  orders: DeliveryOrder[]
}

interface EarningsData {
  today: EarningsPeriod
  thisWeek: EarningsPeriod
  thisMonth: EarningsPeriod
}

export function DriverEarningsClient() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/driver/earnings')
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-24" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Failed to load earnings data</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Earnings</h1>

      {/* Earnings Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-[#16a34a] to-[#15803d]">
          <CardContent className="p-3 text-center text-white">
            <PoundSterling className="h-4 w-4 mx-auto mb-1 opacity-80" />
            <p className="text-xl font-bold">£{data.today.earnings.toFixed(2)}</p>
            <p className="text-[10px] opacity-80 font-medium">Today</p>
            <p className="text-[9px] opacity-60">{data.today.deliveries} delivery{data.today.deliveries !== 1 ? 'ies' : 'y'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">£{data.thisWeek.earnings.toFixed(2)}</p>
            <p className="text-[10px] text-gray-500 font-medium">This Week</p>
            <p className="text-[9px] text-gray-400">{data.thisWeek.deliveries} delivery{data.thisWeek.deliveries !== 1 ? 'ies' : 'y'}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-900">£{data.thisMonth.earnings.toFixed(2)}</p>
            <p className="text-[10px] text-gray-500 font-medium">This Month</p>
            <p className="text-[9px] text-gray-400">{data.thisMonth.deliveries} delivery{data.thisMonth.deliveries !== 1 ? 'ies' : 'y'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Delivery History Tabs */}
      <Tabs defaultValue="today">
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
          <TabsTrigger value="week" className="flex-1">This Week</TabsTrigger>
          <TabsTrigger value="month" className="flex-1">This Month</TabsTrigger>
        </TabsList>

        {(['today', 'week', 'month'] as const).map((period) => {
          const periodData = period === 'today' ? data.today : period === 'week' ? data.thisWeek : data.thisMonth
          return (
            <TabsContent key={period} value={period} className="mt-3">
              {periodData.orders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No completed deliveries</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {periodData.orders.map((order) => (
                    <Card key={order.id} className="shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              #{order.id.slice(-8)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {order.customer.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">
                              {order.address.addressLine1}, {order.address.postcode}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#16a34a]">
                              +£{order.deliveryFee.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(order.updatedAt).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
