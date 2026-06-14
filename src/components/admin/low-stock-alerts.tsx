'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Package, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'

interface LowStockProduct {
  id: string
  name: string
  stockQuantity: number
  minStockThreshold: number
  category: { id: string; name: string }
  isAvailable: boolean
  price: number
  imageUrl: string | null
}

export function LowStockAlerts() {
  const [products, setProducts] = useState<LowStockProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [restockId, setRestockId] = useState<string | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restocking, setRestocking] = useState(false)
  const [inlineEdits, setInlineEdits] = useState<Record<string, string>>({})

  const fetchLowStock = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products/low-stock')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProducts(data.products)
    } catch {
      toast.error('Failed to load low-stock products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLowStock()
  }, [fetchLowStock])

  const handleInlineUpdate = async (id: string) => {
    const qty = parseInt(inlineEdits[id])
    if (isNaN(qty) || qty < 0) {
      toast.error('Enter a valid stock quantity')
      return
    }
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockQuantity: qty }),
      })
      if (!res.ok) throw new Error()
      toast.success('Stock updated')
      setInlineEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      fetchLowStock()
    } catch {
      toast.error('Failed to update stock')
    }
  }

  const handleRestock = async () => {
    if (!restockId) return
    const qty = parseInt(restockQty)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity to add')
      return
    }
    setRestocking(true)
    try {
      const product = products.find((p) => p.id === restockId)
      const newQty = (product?.stockQuantity || 0) + qty
      const res = await fetch(`/api/admin/products/${restockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockQuantity: newQty }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Added ${qty} units — new stock: ${newQty}`)
      setRestockId(null)
      setRestockQty('')
      fetchLowStock()
    } catch {
      toast.error('Failed to restock')
    } finally {
      setRestocking(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">All products are above minimum stock levels</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Low Stock Alerts
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              {products.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchLowStock}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Threshold</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Quick Update</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Restock</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            p.stockQuantity === 0 ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                        />
                        <span className="font-medium text-gray-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="text-xs">{p.category.name}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${
                        p.stockQuantity === 0 ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{p.minStockThreshold}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder={String(p.stockQuantity)}
                          className="w-20 h-8 text-sm"
                          value={inlineEdits[p.id] ?? ''}
                          onChange={(e) =>
                            setInlineEdits((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInlineUpdate(p.id)
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleInlineUpdate(p.id)}
                          disabled={!inlineEdits[p.id]}
                        >
                          Set
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setRestockId(p.id)
                          setRestockQty('')
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Restock
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3 p-4">
            {products.map((p) => (
              <Card key={p.id} className={`border-l-4 ${
                p.stockQuantity === 0 ? 'border-l-red-500' : 'border-l-amber-500'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <Badge variant="secondary" className="text-xs mt-1">{p.category.name}</Badge>
                    </div>
                    <span className={`text-sm font-semibold ${
                      p.stockQuantity === 0 ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {p.stockQuantity === 0 ? 'Out of stock' : `${p.stockQuantity} left`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-500">Min threshold: {p.minStockThreshold}</span>
                    <span className="text-gray-500">{formatPrice(p.price)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      type="number"
                      placeholder="New stock level"
                      className="flex-1 h-9 text-sm"
                      value={inlineEdits[p.id] ?? ''}
                      onChange={(e) =>
                        setInlineEdits((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineUpdate(p.id)
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => handleInlineUpdate(p.id)}
                      disabled={!inlineEdits[p.id]}
                    >
                      Set
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-9 text-xs"
                    onClick={() => {
                      setRestockId(p.id)
                      setRestockQty('')
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Restock
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Restock Modal */}
      <Dialog open={!!restockId} onOpenChange={(open) => !open && setRestockId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restock Product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {restockId && (
              <p className="text-sm text-gray-600">
                Current stock: <strong>{products.find((p) => p.id === restockId)?.stockQuantity ?? 0}</strong>
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="restockQty">Quantity to Add</Label>
              <Input
                id="restockQty"
                type="number"
                min="1"
                placeholder="e.g., 20"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockId(null)}>Cancel</Button>
            <Button
              onClick={handleRestock}
              disabled={restocking || !restockQty}
              className="bg-[#16a34a] hover:bg-[#15803d]"
            >
              {restocking ? 'Restocking...' : 'Add Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
