'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Eye, AlertTriangle, Truck, Package, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'

const statusColors: Record<string, string> = {
  placed: 'bg-blue-50 text-blue-700 border-blue-200',
  picking: 'bg-amber-50 text-amber-700 border-amber-200',
  ready: 'bg-purple-50 text-purple-700 border-purple-200',
  out_for_delivery: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

const statusIcons: Record<string, any> = {
  placed: Clock,
  picking: Package,
  ready: CheckCircle2,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
}

const ORDER_STATUSES = ['placed', 'picking', 'ready', 'out_for_delivery', 'delivered', 'cancelled']

interface OrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  vatRate: number
  subtotal: number
  picked: boolean
}

interface Order {
  id: string
  status: string
  subtotal: number
  vatAmount: number
  deliveryFee: number
  total: number
  paymentStatus: string
  notes: string | null
  createdAt: string
  customer: { id: string; name: string; email: string }
  driver: { id: string; name: string } | null
  items: OrderItem[]
  address?: any
}

interface Driver {
  id: string
  name: string
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [total, setTotal] = useState(0)

  // Detail sheet
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // Drivers for assignment
  const [drivers, setDrivers] = useState<Driver[]>([])

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)

      const res = await fetch(`/api/admin/orders?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setOrders(data.orders)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    // Fetch drivers for assignment
    fetch('/api/admin/drivers')
      .then((r) => r.json())
      .then((d) => setDrivers(d.drivers || []))
      .catch(() => {})
  }, [])

  const handleViewDetail = async (orderId: string) => {
    setDetailLoading(true)
    setSheetOpen(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSelectedOrder(data.order)
    } catch {
      toast.error('Failed to load order details')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Order status updated to ${status}`)
      fetchOrders()
      // Refresh detail if open
      if (selectedOrder?.id === orderId) {
        handleViewDetail(orderId)
      }
    } catch {
      toast.error('Failed to update order status')
    }
  }

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, driverId }),
      })
      if (!res.ok) throw new Error()
      toast.success('Driver assigned')
      fetchOrders()
      if (selectedOrder?.id === orderId) {
        handleViewDetail(orderId)
      }
    } catch {
      toast.error('Failed to assign driver')
    }
  }

  const getNextStatuses = (current: string): string[] => {
    const idx = ORDER_STATUSES.indexOf(current)
    if (current === 'cancelled' || current === 'delivered') return []
    if (idx < 0) return []
    // Allow advancing to next or cancelling
    const next: string[] = []
    if (idx < ORDER_STATUSES.length - 2) { // -2 because we skip 'cancelled'
      next.push(ORDER_STATUSES[idx + 1])
    }
    if (current !== 'cancelled') next.push('cancelled')
    return next
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 text-sm">{total} orders total</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by order ID or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Order ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Driver</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Total</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const StatusIcon = statusIcons[o.status] || Clock
                    return (
                      <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-xs">#{o.id.substring(0, 8).toUpperCase()}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{o.customer.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{o.customer.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className={`text-xs ${statusColors[o.status] || ''}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {o.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {o.driver ? (
                            <div className="flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs font-medium">{o.driver.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium">{formatPrice(o.total)}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {new Date(o.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(o.id)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Order Details</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="py-8 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : selectedOrder ? (
            <div className="py-4 space-y-6">
              {/* Order Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">#{selectedOrder.id.substring(0, 8).toUpperCase()}</span>
                  <Badge className={`text-xs ${statusColors[selectedOrder.status] || ''}`}>
                    {selectedOrder.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(selectedOrder.createdAt).toLocaleString('en-GB')}
                </p>
              </div>

              <Separator />

              {/* Status Update */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Update Status</h4>
                <div className="flex flex-wrap gap-2">
                  {getNextStatuses(selectedOrder.status).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={s === 'cancelled' ? 'destructive' : 'default'}
                      className={s !== 'cancelled' ? 'bg-[#16a34a] hover:bg-[#15803d]' : ''}
                      onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                    >
                      {s.replace(/_/g, ' ')}
                    </Button>
                  ))}
                  {getNextStatuses(selectedOrder.status).length === 0 && (
                    <p className="text-sm text-gray-500">No further status changes available</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Assign Driver */}
              {(!['delivered', 'cancelled'].includes(selectedOrder.status)) && (
                <>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Assign Driver</h4>
                    {selectedOrder.driver ? (
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <span className="text-sm">{selectedOrder.driver.name}</span>
                        <Badge variant="outline" className="text-xs">Assigned</Badge>
                      </div>
                    ) : null}
                    <Select onValueChange={(v) => handleAssignDriver(selectedOrder.id, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver..." />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                </>
              )}

              {/* Customer Info */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Customer</h4>
                <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                  <p><strong>Name:</strong> {selectedOrder.customer.name || 'N/A'}</p>
                  <p><strong>Email:</strong> {selectedOrder.customer.email}</p>
                </div>
              </div>

              <Separator />

              {/* Order Items */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Items ({selectedOrder.items.length})</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg text-sm">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} × {formatPrice(item.unitPrice)}</p>
                      </div>
                      <span className="font-medium">{formatPrice(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">VAT</span>
                  <span>{formatPrice(selectedOrder.vatAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Fee</span>
                  <span>{formatPrice(selectedOrder.deliveryFee)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">Notes</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedOrder.notes}</p>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
