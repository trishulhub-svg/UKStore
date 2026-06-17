'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Eye, AlertTriangle, ShieldBan, ShieldCheck, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { exportTableToPdf } from '@/lib/client-pdf'

interface Customer {
  id: string
  name: string | null
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  orderCount: number
  totalSpent: number
  orders: Array<{
    id: string
    total: number
    status: string
    createdAt: string
  }>
}

interface CustomerDetail {
  id: string
  name: string | null
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  totalSpent: number
  addresses: any[]
  orders: Array<{
    id: string
    total: number
    subtotal: number
    vatAmount: number
    deliveryFee: number
    status: string
    paymentStatus: string
    createdAt: string
    items: Array<{ productName: string; quantity: number; unitPrice: number }>
  }>
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [banningId, setBanningId] = useState<string | null>(null)

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/customers?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCustomers(data.customers)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleViewDetail = async (customerId: string) => {
    setDetailLoading(true)
    setSheetOpen(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSelectedCustomer(data.customer)
    } catch {
      toast.error('Failed to load customer details')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleToggleBan = async (customerId: string, currentIsActive: boolean) => {
    setBanningId(customerId)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentIsActive }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      // Update local state
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId ? { ...c, isActive: data.customer.isActive } : c
        )
      )

      toast.success(
        data.customer.isActive
          ? 'Customer has been unbanned'
          : 'Customer has been banned'
      )
    } catch {
      toast.error('Failed to update customer status')
    } finally {
      setBanningId(null)
    }
  }

  const handleExportPdf = async () => {
    if (customers.length === 0) {
      toast.error('No customers to export')
      return
    }
    try {
      await exportTableToPdf({
        title: 'Customers',
        subtitle: `${total} customer${total === 1 ? '' : 's'}`,
        filename: `customers-${new Date().toISOString().split('T')[0]}.pdf`,
        columns: ['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Status', 'Joined'],
        rows: customers.map((c) => [
          c.name || '—',
          c.email,
          c.phone || '—',
          c.orderCount,
          formatPrice(c.totalSpent),
          c.isActive ? 'Active' : 'Banned',
          new Date(c.createdAt).toLocaleDateString('en-GB'),
        ]),
        footer: `Total revenue from listed customers: ${formatPrice(customers.reduce((s, c) => s + c.totalSpent, 0))}`,
      })
      toast.success('PDF exported')
    } catch {
      toast.error('Failed to export PDF')
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm">{total} customers</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportPdf}
          disabled={customers.length === 0}
          className="border-gray-300"
        >
          <FileDown className="h-4 w-4 mr-1" /> Export PDF
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No customers found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Orders</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Total Spent</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Joined</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {c.name || 'N/A'}
                            {!c.isActive && (
                              <Badge variant="destructive" className="text-xs">Banned</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{c.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-xs">{c.orderCount}</Badge>
                        </td>
                        <td className="py-3 px-4 font-medium">{formatPrice(c.totalSpent)}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {new Date(c.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant={c.isActive ? 'outline' : 'default'}
                              size="sm"
                              onClick={() => handleToggleBan(c.id, c.isActive)}
                              disabled={banningId === c.id}
                              className={
                                c.isActive
                                  ? 'text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }
                            >
                              {banningId === c.id ? (
                                '...'
                              ) : c.isActive ? (
                                <><ShieldBan className="h-3.5 w-3.5 mr-1" /> Ban</>
                              ) : (
                                <><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Unban</>
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleViewDetail(c.id)}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {customers.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900 flex items-center gap-2">
                            {c.name || 'N/A'}
                            {!c.isActive && (
                              <Badge variant="destructive" className="text-xs">Banned</Badge>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Email</span>
                          <span className="font-medium text-sm">{c.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Orders</span>
                          <Badge variant="secondary" className="text-xs">{c.orderCount}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Total Spent</span>
                          <span className="font-medium">{formatPrice(c.totalSpent)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Joined</span>
                          <span className="font-medium text-sm">
                            {new Date(c.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          variant={c.isActive ? 'outline' : 'default'}
                          size="sm"
                          className={
                            c.isActive
                              ? 'flex-1 text-red-600 border-red-200 hover:bg-red-50 min-h-10'
                              : 'flex-1 bg-green-600 hover:bg-green-700 text-white min-h-10'
                          }
                          onClick={() => handleToggleBan(c.id, c.isActive)}
                          disabled={banningId === c.id}
                        >
                          {c.isActive ? (
                            <><ShieldBan className="h-4 w-4 mr-1" /> Ban</>
                          ) : (
                            <><ShieldCheck className="h-4 w-4 mr-1" /> Unban</>
                          )}
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 min-h-10" onClick={() => handleViewDetail(c.id)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Customer Details</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="py-8 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : selectedCustomer ? (
            <div className="py-4 space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{selectedCustomer.name || 'N/A'}</p>
                  {!selectedCustomer.isActive && (
                    <Badge variant="destructive" className="text-xs">Banned</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">{selectedCustomer.email}</p>
                {selectedCustomer.phone && <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>}
                <p className="text-sm text-gray-500">
                  Joined {new Date(selectedCustomer.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
                <Separator className="my-2" />
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Orders:</span>{' '}
                    <span className="font-medium">{selectedCustomer.orders.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Spent:</span>{' '}
                    <span className="font-medium">{formatPrice(selectedCustomer.totalSpent)}</span>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              {selectedCustomer.addresses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Addresses</h4>
                  {selectedCustomer.addresses.map((addr: any) => (
                    <div key={addr.id} className="bg-gray-50 p-3 rounded-lg text-sm">
                      <p>{addr.addressLine1}</p>
                      {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                      <p>{addr.city}, {addr.postcode}</p>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Order History */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Order History</h4>
                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-sm text-gray-500">No orders yet</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {selectedCustomer.orders.map((o) => (
                      <div key={o.id} className="bg-gray-50 p-3 rounded-lg text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs">#{o.id.substring(0, 8).toUpperCase()}</span>
                          <Badge variant="secondary" className="text-xs">{o.status}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {new Date(o.createdAt).toLocaleDateString('en-GB')}
                          </span>
                          <span className="font-medium">{formatPrice(o.total)}</span>
                        </div>
                        {o.items.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            {o.items.map((item, idx) => (
                              <span key={idx}>
                                {item.productName} ×{item.quantity}
                                {idx < o.items.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
