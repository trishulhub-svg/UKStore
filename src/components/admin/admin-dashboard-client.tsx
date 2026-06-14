'use client'

import Link from 'next/link'
import {
  PoundSterling,
  ShoppingBag,
  Truck,
  Clock,
  PackagePlus,
  ClipboardList,
  Users,
  Tag,
  AlertTriangle,
  ChevronRight,
  Bike,
  Car,
  TruckIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPrice } from '@/lib/vat'

// ─── Types ──────────────────────────────────────────────

interface DashboardData {
  todayRevenue: number
  ordersToday: number
  ordersTodayBreakdown: {
    placed: number
    confirmed: number
    picking: number
    ready: number
    out_for_delivery: number
    delivered: number
    cancelled: number
  }
  activeDeliveries: number
  pendingOrders: number
  revenueChart: { date: string; revenue: number }[]
  orderStatusBreakdown: { status: string; count: number }[]
  recentOrders: {
    id: string
    status: string
    total: number
    created_at: string
    customer: { name: string; email: string } | null
  }[]
  activeDrivers: {
    user_id: string
    vehicle_type: string | null
    full_name: string | null
  }[]
  lowStockProducts: {
    id: string
    name: string
    stock_quantity: number
    category: { name: string } | null
  }[]
}

interface AdminDashboardClientProps {
  data: DashboardData
}

// ─── Constants ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  placed: '#3b82f6',           // blue
  confirmed: '#6366f1',       // indigo
  picking: '#f59e0b',         // amber
  ready: '#a855f7',           // purple
  out_for_delivery: '#f97316', // orange
  delivered: '#16a34a',       // green
  cancelled: '#ef4444',       // red
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  placed: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  picking: 'bg-amber-50 text-amber-700 border-amber-200',
  ready: 'bg-purple-50 text-purple-700 border-purple-200',
  out_for_delivery: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  picking: 'Picking',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const BRAND_GREEN = '#16a34a'

// ─── Helpers ────────────────────────────────────────────

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getVehicleIcon(vehicleType: string | null) {
  switch (vehicleType) {
    case 'bicycle':
      return Bike
    case 'motorcycle':
      return Bike
    case 'car':
      return Car
    case 'van':
      return TruckIcon
    default:
      return Truck
  }
}

function getVehicleLabel(vehicleType: string | null): string {
  switch (vehicleType) {
    case 'bicycle': return 'Bicycle'
    case 'motorcycle': return 'Motorcycle'
    case 'car': return 'Car'
    case 'van': return 'Van'
    default: return 'Vehicle'
  }
}

// ─── Custom Tooltip for Revenue Chart ───────────────────

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="text-sm font-bold" style={{ color: BRAND_GREEN }}>
        {formatPrice(payload[0].value)}
      </p>
    </div>
  )
}

// ─── Custom Tooltip for Pie Chart ───────────────────────

function StatusTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { status, count } = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium" style={{ color: STATUS_COLORS[status] || '#666' }}>
        {STATUS_LABELS[status] || status}
      </p>
      <p className="text-sm font-bold text-gray-900">{count} orders</p>
    </div>
  )
}

// ─── Custom Legend for Pie Chart ────────────────────────

function StatusLegend({ payload }: any) {
  if (!payload?.length) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
      {payload.map((entry: any) => {
        const status = entry.value
        return (
          <div key={status} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: STATUS_COLORS[status] || '#999' }}
            />
            <span className="text-gray-600">{STATUS_LABELS[status] || status}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────

export function AdminDashboardClient({ data }: AdminDashboardClientProps) {
  const {
    todayRevenue,
    ordersToday,
    ordersTodayBreakdown,
    activeDeliveries,
    pendingOrders,
    revenueChart,
    orderStatusBreakdown,
    recentOrders,
    activeDrivers,
    lowStockProducts,
  } = data

  // Prepare chart data with formatted date labels
  const chartData = revenueChart.map((d) => ({
    ...d,
    label: formatChartDate(d.date),
  }))

  // Pie chart data with status labels
  const pieData = orderStatusBreakdown.map((d) => ({
    ...d,
    label: STATUS_LABELS[d.status] || d.status,
  }))

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Welcome back — here&apos;s what&apos;s happening at Fresh Mart today
        </p>
      </div>

      {/* ═══════════ ROW 1: Top Stats ═══════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Today's Revenue */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Today&apos;s Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatPrice(todayRevenue)}
                </p>
                {todayRevenue > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs font-medium text-green-600">↑ Revenue today</span>
                  </div>
                )}
              </div>
              <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center">
                <PoundSterling className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Today */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Orders Today</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{ordersToday}</p>
                {ordersToday > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <span>
                      {ordersTodayBreakdown.placed + ordersTodayBreakdown.confirmed} placed
                    </span>
                    <span className="text-gray-300">·</span>
                    <span>{ordersTodayBreakdown.picking} picking</span>
                    <span className="text-gray-300">·</span>
                    <span>{ordersTodayBreakdown.delivered} delivered</span>
                  </div>
                )}
              </div>
              <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Deliveries */}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Deliveries</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{activeDeliveries}</p>
                {activeDeliveries > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    {ordersTodayBreakdown.out_for_delivery} out for delivery
                  </p>
                )}
              </div>
              <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center">
                <Truck className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card className={`border-l-4 ${pendingOrders > 0 ? 'border-l-amber-500' : 'border-l-gray-300'}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{pendingOrders}</p>
                {pendingOrders > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-medium text-amber-600">Needs attention</span>
                  </div>
                )}
                {pendingOrders === 0 && (
                  <p className="text-xs text-gray-400 mt-1">All caught up</p>
                )}
              </div>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                pendingOrders > 0 ? 'bg-amber-50' : 'bg-gray-50'
              }`}>
                <Clock className={`h-5 w-5 ${
                  pendingOrders > 0 ? 'text-amber-600' : 'text-gray-400'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ ROW 2: Charts ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChart.length === 0 || revenueChart.every((d) => d.revenue === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <PoundSterling className="h-10 w-10 mb-3" />
                <p className="text-sm">No revenue data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#888' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#888' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `£${v}`}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar
                    dataKey="revenue"
                    fill={BRAND_GREEN}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Status Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {orderStatusBreakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ShoppingBag className="h-10 w-10 mb-3" />
                <p className="text-sm">No orders yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || '#999'}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<StatusTooltip />} />
                  <Legend content={<StatusLegend />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ ROW 3: Recent Orders + Quick Actions ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Orders Table — spans 2 columns on lg */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
            <Link href="/admin/orders">
              <Button variant="ghost" size="sm" className="text-sm text-gray-500 hover:text-gray-900">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <ShoppingBag className="h-10 w-10 mb-3" />
                <p className="text-sm">No orders yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => {
                        window.location.href = '/admin/orders'
                      }}
                    >
                      <TableCell className="font-mono text-xs">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {order.customer?.name || (
                          <span className="text-gray-400 italic">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs border ${STATUS_BADGE_CLASSES[order.status] || ''}`}
                        >
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatPrice(order.total)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-gray-500">
                        {formatTimeAgo(order.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/products/new" className="block">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3.5 hover:bg-green-50 hover:border-green-200 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <PackagePlus className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-green-700">Add Product</p>
                  <p className="text-xs text-gray-500">Create a new product listing</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-green-500 flex-shrink-0" />
              </div>
            </Link>

            <Link href="/admin/orders" className="block">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3.5 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">View All Orders</p>
                  <p className="text-xs text-gray-500">Manage & process orders</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
              </div>
            </Link>

            <Link href="/admin/drivers" className="block">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3.5 hover:bg-orange-50 hover:border-orange-200 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-orange-700">Manage Drivers</p>
                  <p className="text-xs text-gray-500">Driver roster & verification</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-orange-500 flex-shrink-0" />
              </div>
            </Link>

            <Link href="/admin/promotions" className="block">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3.5 hover:bg-purple-50 hover:border-purple-200 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Tag className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-purple-700">Create Promotion</p>
                  <p className="text-xs text-gray-500">Set up discounts & deals</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-purple-500 flex-shrink-0" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ ROW 4: Active Drivers + Low Stock Alert ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Active Drivers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Active Drivers</CardTitle>
            <Link href="/admin/drivers">
              <Button variant="ghost" size="sm" className="text-sm text-gray-500 hover:text-gray-900">
                Manage
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {activeDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Truck className="h-10 w-10 mb-3" />
                <p className="text-sm">No drivers on duty</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {activeDrivers.map((driver) => {
                  const VehicleIcon = getVehicleIcon(driver.vehicle_type)
                  return (
                    <div
                      key={driver.user_id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <VehicleIcon className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {driver.full_name || 'Unknown Driver'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getVehicleLabel(driver.vehicle_type)}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-green-50 text-green-700 border border-green-200 flex-shrink-0"
                      >
                        On Duty
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className={lowStockProducts.length > 0 ? 'border-amber-200' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">Low Stock Alert</CardTitle>
              {lowStockProducts.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-xs">
                  {lowStockProducts.length}
                </Badge>
              )}
            </div>
            <Link href="/admin/products">
              <Button variant="ghost" size="sm" className="text-sm text-gray-500 hover:text-gray-900">
                View Products
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <PackagePlus className="h-10 w-10 mb-3" />
                <p className="text-sm">All products well-stocked</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.category?.name || 'Uncategorised'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${
                        product.stock_quantity === 0
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}>
                        {product.stock_quantity} left
                      </p>
                      {product.stock_quantity === 0 && (
                        <p className="text-xs text-red-500">Out of stock</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
