'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Clock, Package, Truck, CheckCircle2, AlertTriangle, Wine, Loader2, ChevronDown, Layers, MapPin, UserPlus, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'

// ─── Types ────────────────────────────────────────────────────

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
  paymentMethod?: string
  hasChallenge25?: boolean
  challenge25Verified?: boolean
  batchGroup?: string | null
  notes: string | null
  createdAt: string
  customer: { id: string; name: string; email: string }
  driver: { id: string; name: string } | null
  items: OrderItem[]
}

interface Driver {
  id: string
  name: string
}

// ─── Column Definitions ───────────────────────────────────────

type KanbanColumn = 'placed' | 'picking' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'

const COLUMNS: { id: KanbanColumn; title: string; icon: any; color: string; bgColor: string }[] = [
  { id: 'placed', title: 'New Orders', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'picking', title: 'Packing', icon: Package, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'ready', title: 'Ready', icon: CheckCircle2, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'out_for_delivery', title: 'Out for Delivery', icon: Truck, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { id: 'delivered', title: 'Delivered', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'cancelled', title: 'Cancelled', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
]

// ─── Time Since Order ─────────────────────────────────────────

function TimeSince({ date, threshold, }: { date: string; threshold: number }) {
  const [elapsed, setElapsed] = useState(() => getMinutesSince(date))

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getMinutesSince(date))
    }, 30000) // update every 30s
    return () => clearInterval(interval)
  }, [date])

  const isOverdue = elapsed >= threshold
  const minutes = Math.floor(elapsed)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const display = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
      <Clock className="h-3 w-3" />
      {display}
      {isOverdue && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
    </span>
  )
}

function getMinutesSince(dateStr: string): number {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  return (now - then) / 60000
}

// ─── Kanban Card ──────────────────────────────────────────────

function KanbanCard({
  order,
  drivers,
  onMove,
  onAssignDriver,
  onRefund,
}: {
  order: Order
  drivers: Driver[]
  onMove: (orderId: string, newStatus: string) => void
  onAssignDriver: (orderId: string, driverId: string) => void
  onRefund: (orderId: string, reason: string) => Promise<void>
}) {
  const [assigningDriver, setAssigningDriver] = useState(false)
  const [moving, setMoving] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refunding, setRefunding] = useState(false)
  const shortId = `#${order.id.substring(0, 8).toUpperCase()}`
  const hasAgeRestricted = order.hasChallenge25 || order.items?.some(item => item.vatRate === 0.2 || item.product?.isAgeRestricted)

  // Generate a consistent colour for batch groups
  const batchColours = ['bg-teal-100 text-teal-700 border-teal-300', 'bg-violet-100 text-violet-700 border-violet-300', 'bg-rose-100 text-rose-700 border-rose-300', 'bg-sky-100 text-sky-700 border-sky-300', 'bg-amber-100 text-amber-700 border-amber-300']
  const batchColourIndex = order.batchGroup ? order.batchGroup.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % batchColours.length : 0

  const paymentBadgeColor: Record<string, string> = {
    paid: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    refunded: 'bg-gray-100 text-gray-700 border-gray-200',
  }

  const handleMove = async (newStatus: string) => {
    setMoving(true)
    await onMove(order.id, newStatus)
    setMoving(false)
  }

  const handleAssignDriver = async (driverId: string) => {
    await onAssignDriver(order.id, driverId)
    setAssigningDriver(false)
  }

  return (
    <Card className="mb-3 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-gray-500">{shortId}</p>
            <p className="font-medium text-sm text-gray-900 mt-0.5">{order.customer.name || 'N/A'}</p>
          </div>
          <span className="font-bold text-sm">{formatPrice(order.total)}</span>
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${paymentBadgeColor[order.paymentStatus] || ''}`}>
            {order.paymentStatus}
          </Badge>
          {hasAgeRestricted && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200">
              <Wine className="h-2.5 w-2.5 mr-0.5" />
              Challenge 25
            </Badge>
          )}
          {order.paymentMethod === 'bank_transfer' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
              Bank Transfer
            </Badge>
          )}
          {order.batchGroup && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${batchColours[batchColourIndex]}`}>
              <Layers className="h-2.5 w-2.5 mr-0.5" />
              {order.batchGroup}
            </Badge>
          )}
        </div>

        {/* Time */}
        <div className="flex items-center justify-between">
          <TimeSince
            date={order.createdAt}
            threshold={order.status === 'placed' ? 15 : order.status === 'picking' ? 30 : 999}
          />
          {order.driver && (
            <span className="text-[10px] text-gray-500">
              Driver: {order.driver.name}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="pt-1 border-t border-gray-100">
          {order.status === 'placed' && (
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => handleMove('picking')}
              disabled={moving}
            >
              {moving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Package className="h-3 w-3 mr-1" />}
              Start Packing
            </Button>
          )}
          {order.status === 'picking' && (
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-purple-500 hover:bg-purple-600 text-white"
              onClick={() => handleMove('ready')}
              disabled={moving}
            >
              {moving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              Mark Ready
            </Button>
          )}
          {order.status === 'ready' && !assigningDriver && (
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => setAssigningDriver(true)}
            >
              <Truck className="h-3 w-3 mr-1" />
              Assign Driver
            </Button>
          )}
          {order.status === 'ready' && assigningDriver && (
            <div className="space-y-1.5">
              <Select onValueChange={handleAssignDriver}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-gray-500"
                onClick={() => setAssigningDriver(false)}
              >
                Cancel
              </Button>
            </div>
          )}
          {order.status === 'out_for_delivery' && (
            <Button
              size="sm"
              className="w-full h-8 text-xs bg-green-500 hover:bg-green-600 text-white"
              onClick={() => handleMove('delivered')}
              disabled={moving}
            >
              {moving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              Mark Delivered
            </Button>
          )}
          {/* Refund button for paid orders */}
          {(order.paymentStatus === 'paid' || order.paymentStatus === 'pending') && order.status !== 'cancelled' && order.status !== 'delivered' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full h-8 text-xs mt-1"
                  disabled={refunding}
                >
                  {refunding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                  Refund Order
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Refund Order {shortId}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel the order and issue a refund of {formatPrice(order.total)}.
                    {order.paymentMethod === 'stripe' && ' The refund will be processed via Stripe.'}
                    {order.paymentMethod === 'cash' && ' No automatic refund — cash was to be collected on delivery.'}
                    {order.paymentMethod === 'bank_transfer' && ' The customer should be contacted about the bank transfer refund.'}
                    {' '}This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor={`refund-reason-${order.id}`} className="text-sm font-medium">
                    Reason for refund
                  </Label>
                  <Textarea
                    id={`refund-reason-${order.id}`}
                    placeholder="e.g., Customer request, item out of stock, delivery issue..."
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setRefundReason('')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!refundReason.trim() || refunding}
                    onClick={async () => {
                      setRefunding(true)
                      await onRefund(order.id, refundReason.trim())
                      setRefunding(false)
                      setRefundReason('')
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {refunding ? 'Processing...' : 'Confirm Refund'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {/* Show refunded badge if already refunded */}
          {order.paymentStatus === 'refunded' && (
            <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mt-1">
              <RotateCcw className="h-3 w-3" />
              Refunded
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Batch Suggestion Types ────────────────────────────────────

interface BatchOrder {
  id: string
  status: string
  total: number
  customerName: string
  postcode: string
  addressLine1: string
  driver: { id: string; name: string } | null
  createdAt: string
}

interface BatchGroup {
  area: string
  orderCount: number
  orders: BatchOrder[]
}

// ─── Batch Suggestions Panel ──────────────────────────────────

function BatchSuggestionsPanel({ drivers, onBatchAssigned }: { drivers: Driver[]; onBatchAssigned: () => void }) {
  const [batches, setBatches] = useState<BatchGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders/batching')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBatches(data.batches || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBatches()
    const interval = setInterval(fetchBatches, 60000)
    return () => clearInterval(interval)
  }, [fetchBatches])

  const handleAssignBatch = async (area: string, driverId: string) => {
    const batch = batches.find((b) => b.area === area)
    if (!batch) return

    setAssigning(true)
    try {
      const res = await fetch('/api/admin/orders/batching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: batch.orders.map((o) => o.id),
          driverId,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`Batch ${area} assigned to ${data.driverName} (${data.assignedOrders} orders)`)
      setAssigningDriver(null)
      fetchBatches()
      onBatchAssigned()
    } catch {
      toast.error('Failed to assign batch')
    } finally {
      setAssigning(false)
    }
  }

  if (loading || batches.length === 0) return null

  return (
    <Card className="mb-4 border-teal-200 bg-teal-50/50">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-teal-800">
          <Layers className="h-4 w-4" />
          Batch Suggestions
          <Badge variant="outline" className="text-[10px] bg-teal-100 text-teal-700 border-teal-300">
            {batches.length} group{batches.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {batches.map((batch) => (
          <div key={batch.area} className="bg-white rounded-lg border border-teal-200 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between p-3 hover:bg-teal-50/50 transition-colors text-left"
              onClick={() => setExpanded(expanded === batch.area ? null : batch.area)}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-medium text-gray-900">{batch.area}</span>
                <Badge variant="outline" className="text-[10px] bg-teal-100 text-teal-700 border-teal-300">
                  {batch.orderCount} orders
                </Badge>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded === batch.area ? 'rotate-180' : ''}`} />
            </button>

            {expanded === batch.area && (
              <div className="border-t border-teal-200 p-3 space-y-2">
                {batch.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-gray-500">#{order.id.substring(0, 6).toUpperCase()}</span>
                      <span className="text-gray-700 ml-2">{order.customerName}</span>
                    </div>
                    <span className="text-gray-500">{order.postcode}</span>
                  </div>
                ))}

                {assigningDriver === batch.area ? (
                  <div className="space-y-2 pt-2">
                    <Select onValueChange={(driverId) => handleAssignBatch(batch.area, driverId)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select driver to assign batch..." />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs text-gray-500"
                      onClick={() => setAssigningDriver(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white mt-2"
                    onClick={() => setAssigningDriver(batch.area)}
                    disabled={assigning}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Assign Batch to Driver
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Main Kanban Board ────────────────────────────────────────

export function KanbanOrderBoard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [newOrderCount, setNewOrderCount] = useState(0)
  const prevNewOrderCountRef = useRef(0)
  const [showAlert, setShowAlert] = useState(false)

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders?limit=100')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const newOrders: Order[] = data.orders || []
      setOrders(prev => {
        const prevPlacedCount = prev.filter(o => o.status === 'placed').length
        const newPlacedCount = newOrders.filter(o => o.status === 'placed').length
        if (newPlacedCount > prevPlacedCount && prevPlacedCount > 0) {
          setShowAlert(true)
          setTimeout(() => setShowAlert(false), 10000)
        }
        return newOrders
      })
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  // Fetch drivers
  useEffect(() => {
    fetch('/api/admin/drivers')
      .then((r) => r.json())
      .then((d) => setDrivers(d.drivers || []))
      .catch(() => {})
  }, [])

  const handleMove = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Order moved to ${newStatus.replace(/_/g, ' ')}`)
      fetchOrders()
    } catch {
      toast.error('Failed to update order status')
    }
  }

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, driverId, status: 'out_for_delivery' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Driver assigned & order dispatched')
      fetchOrders()
    } catch {
      toast.error('Failed to assign driver')
    }
  }

  const handleRefund = async (orderId: string, reason: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Refund failed')
      }
      toast.success('Order refunded successfully')
      fetchOrders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process refund')
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.id} className="space-y-3">
            <Skeleton className="h-8 w-32" />
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Batch Suggestions Panel */}
      <BatchSuggestionsPanel drivers={drivers} onBatchAssigned={fetchOrders} />

      {/* Kanban Columns */}
      <div className="overflow-x-auto pb-4 -mx-2 px-2">
      <div className="flex gap-4 min-w-[900px] lg:min-w-0">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((o) => o.status === column.id)
          const Icon = column.icon
          const isNewColumn = column.id === 'placed'

          return (
            <div key={column.id} className="flex-1 min-w-[220px]">
              {/* Column Header */}
              <div className={`rounded-t-lg ${column.bgColor} p-3 border border-b-0 border-gray-200`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${column.color}`} />
                    <h3 className="font-semibold text-sm text-gray-800">{column.title}</h3>
                    {isNewColumn && showAlert && (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs h-5 min-w-[24px] justify-center">
                    {columnOrders.length}
                  </Badge>
                </div>
              </div>

              {/* Column Body */}
              <div className="bg-gray-50/50 border border-t-0 border-gray-200 rounded-b-lg p-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto space-y-0"
                style={{ scrollbarWidth: 'thin' }}
              >
                {columnOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-gray-400 text-xs">
                    No orders
                  </div>
                ) : (
                  columnOrders.map((order) => (
                    <KanbanCard
                      key={order.id}
                      order={order}
                      drivers={drivers}
                      onMove={handleMove}
                      onAssignDriver={handleAssignDriver}
                      onRefund={handleRefund}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
