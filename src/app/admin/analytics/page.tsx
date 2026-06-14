'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, ShoppingBag, Users, DollarSign, Truck, TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatPrice } from '@/lib/vat'

interface AnalyticsData {
  summary: {
    totalProducts: number
    totalOrders: number
    totalCustomers: number
    totalRevenue: number
    avgDeliveryMinutes: number
    deliveredCount: number
  }
  revenueChart: Array<{ date: string; revenue: number }>
  statusPieChart: Array<{ status: string; count: number }>
  topProductsChart: Array<{ name: string; quantity: number; revenue: number }>
}

const STATUS_COLORS: Record<string, string> = {
  placed: '#3b82f6',
  picking: '#f59e0b',
  ready: '#8b5cf6',
  out_for_delivery: '#f97316',
  delivered: '#16a34a',
  cancelled: '#ef4444',
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm">Store performance overview</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load analytics</p>
      </div>
    )
  }

  const { summary, revenueChart, statusPieChart, topProductsChart } = data

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm">Store performance overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{formatPrice(summary.totalRevenue)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Orders</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{summary.totalOrders}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Customers</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{summary.totalCustomers}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Delivery</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{summary.avgDeliveryMinutes} min</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            {summary.deliveredCount > 0 && (
              <p className="text-xs text-gray-500 mt-1">{summary.deliveredCount} delivered orders</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#16a34a]" />
              Revenue (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {revenueChart.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No revenue data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <LineChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: isMobile ? 9 : 11 }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v)
                      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    }}
                  />
                  <YAxis tick={{ fontSize: isMobile ? 9 : 11 }} width={isMobile ? 40 : 60} tickFormatter={(v: number) => `£${v}`} />
                  <Tooltip
                    formatter={(value: number) => [formatPrice(value), 'Revenue']}
                    labelFormatter={(label: string) => new Date(label).toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Orders by Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Orders by Status
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {statusPieChart.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No order data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <PieChart>
                  <Pie
                    data={statusPieChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 40 : 60}
                    outerRadius={isMobile ? 70 : 100}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => {
                      const label = isMobile
                        ? status.length > 8 ? status.substring(0, 7) + '…' : status
                        : status.replace(/_/g, ' ')
                      return `${label}: ${count}`
                    }}
                  >
                    {statusPieChart.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name.replace(/_/g, ' ')]} />
                  <Legend formatter={(value: string) => value.replace(/_/g, ' ')} wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-600" />
            Top Selling Products
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden">
          {topProductsChart.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 260 : 350}>
              <BarChart data={topProductsChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: isMobile ? 9 : 11 }}
                  width={isMobile ? 70 : 120}
                  tickFormatter={(v: string) => {
                    const maxLen = isMobile ? 8 : 15
                    return v.length > maxLen ? v.substring(0, maxLen) + '…' : v
                  }}
                />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                <Bar dataKey="quantity" fill="#16a34a" name="Quantity" radius={[0, 4, 4, 0]} />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (£)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
