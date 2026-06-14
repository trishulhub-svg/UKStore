'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Search, Plus, TrendingDown, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'

interface WastageLog {
  id: string
  productId: string
  productName: string
  productPrice: number
  category: string
  quantity: number
  reason: string
  notes: string | null
  loggedBy: string
  createdAt: string
}

interface Product {
  id: string
  name: string
  categoryId: string
  category: { id: string; name: string }
}

interface Summary {
  weeklyCost: number
  monthlyCost: number
  weeklyCount: number
  monthlyCount: number
}

const reasonLabels: Record<string, string> = {
  expired: 'Expired',
  damaged: 'Damaged',
  spoiled: 'Spoiled',
  other: 'Other',
}

const reasonColors: Record<string, string> = {
  expired: 'bg-red-100 text-red-700',
  damaged: 'bg-orange-100 text-orange-700',
  spoiled: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-700',
}

export function WastageClient() {
  const [logs, setLogs] = useState<WastageLog[]>([])
  const [summary, setSummary] = useState<Summary>({ weeklyCost: 0, monthlyCost: 0, weeklyCount: 0, monthlyCount: 0 })
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Filters
  const [filterReason, setFilterReason] = useState('all')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  // New log form
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [logQuantity, setLogQuantity] = useState('')
  const [logReason, setLogReason] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const fetchWastage = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterReason !== 'all') params.set('reason', filterReason)
      if (filterStartDate) params.set('startDate', filterStartDate)
      if (filterEndDate) params.set('endDate', filterEndDate)

      const res = await fetch(`/api/admin/wastage?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setSummary(data.summary)
    } catch {
      toast.error('Failed to load wastage logs')
    } finally {
      setLoading(false)
    }
  }, [filterReason, filterStartDate, filterEndDate])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/admin/products?limit=200')
      if (!res.ok) return
      const data = await res.json()
      setProducts(data.products)
    } catch {}
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    fetchWastage()
  }, [fetchWastage])

  const handleCreateLog = async () => {
    if (!selectedProductId || !logQuantity || !logReason) {
      toast.error('Product, quantity, and reason are required')
      return
    }
    const qty = parseInt(logQuantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/wastage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: qty,
          reason: logReason,
          notes: logNotes,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success('Wastage logged — stock decremented')
      setDialogOpen(false)
      setSelectedProductId('')
      setLogQuantity('')
      setLogReason('')
      setLogNotes('')
      setProductSearch('')
      fetchWastage()
    } catch (err: any) {
      toast.error(err.message || 'Failed to log wastage')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  // Group products by category for the dropdown
  const productsByCategory = filteredProducts.reduce<Record<string, Product[]>>((acc, p) => {
    const catName = p.category?.name || 'Other'
    if (!acc[catName]) acc[catName] = []
    acc[catName].push(p)
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wastage &amp; Expiry Log</h1>
          <p className="text-gray-500 text-sm">Track expired, damaged, and spoiled products</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#16a34a] hover:bg-[#15803d]">
          <Plus className="h-4 w-4 mr-1" /> Log Wastage
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">This Week</p>
                <p className="text-xl font-bold text-red-600 mt-1">{formatPrice(summary.weeklyCost)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{summary.weeklyCount} log entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">This Month</p>
                <p className="text-xl font-bold text-red-600 mt-1">{formatPrice(summary.monthlyCost)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{summary.monthlyCount} log entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Logs</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{total}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg per Week</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {summary.weeklyCount > 0 ? formatPrice(summary.weeklyCost / Math.max(summary.weeklyCount, 1)) : '£0.00'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Filter className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={filterReason} onValueChange={setFilterReason}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="spoiled">Spoiled</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 flex-1">
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="flex-1"
                placeholder="From date"
              />
              <span className="text-gray-400 text-sm">to</span>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="flex-1"
                placeholder="To date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wastage Logs */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No wastage logs found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Product</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Category</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Quantity</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Cost</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Reason</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{log.productName}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-xs">{log.category}</Badge>
                        </td>
                        <td className="py-3 px-4">{log.quantity}</td>
                        <td className="py-3 px-4 text-red-600 font-medium">
                          {formatPrice(log.productPrice * log.quantity)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`text-xs ${reasonColors[log.reason] || 'bg-gray-100 text-gray-700'}`}>
                            {reasonLabels[log.reason] || log.reason}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {new Date(log.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {logs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{log.productName}</p>
                          {log.category && (
                            <Badge variant="secondary" className="text-xs mt-1">{log.category}</Badge>
                          )}
                        </div>
                        <Badge className={`text-xs ${reasonColors[log.reason] || 'bg-gray-100 text-gray-700'}`}>
                          {reasonLabels[log.reason] || log.reason}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Qty: </span>
                          <span className="font-medium">{log.quantity}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Cost: </span>
                          <span className="font-medium text-red-600">
                            {formatPrice(log.productPrice * log.quantity)}
                          </span>
                        </div>
                      </div>
                      {log.notes && (
                        <p className="text-xs text-gray-500 mt-2 italic">{log.notes}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(log.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Wastage Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Wastage</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 mb-2"
                />
              </div>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {Object.entries(productsByCategory).map(([category, prods]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                        {category}
                      </div>
                      {prods.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="logQty">Quantity *</Label>
                <Input
                  id="logQty"
                  type="number"
                  min="1"
                  placeholder="e.g., 5"
                  value={logQuantity}
                  onChange={(e) => setLogQuantity(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Reason *</Label>
                <Select value={logReason} onValueChange={setLogReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="spoiled">Spoiled</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logNotes">Notes</Label>
              <Textarea
                id="logNotes"
                placeholder="Optional details..."
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
              />
            </div>
            <p className="text-xs text-amber-600">
              ⚠️ Stock will be decremented by the specified quantity when logging wastage.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateLog}
              disabled={saving || !selectedProductId || !logQuantity || !logReason}
              className="bg-[#16a34a] hover:bg-[#15803d]"
            >
              {saving ? 'Saving...' : 'Log Wastage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
