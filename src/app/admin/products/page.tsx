'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, ArrowUpDown, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle, FileDown } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatPrice, getVatRateLabel } from '@/lib/vat'
import { CsvImportExport } from '@/components/admin/csv-import-export'
import { exportTableToPdf } from '@/lib/client-pdf'
import { apiFetch } from '@/lib/api-fetch'

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  vatRate: number
  isHfss: boolean
  isAgeRestricted: boolean
  minimumAge: number
  imageUrl: string | null
  barcode: string | null
  unit: string
  weightKg: number | null
  aisle: string | null
  minStockThreshold: number
  substituteProductId: string | null
  isAvailable: boolean
  stockQuantity: number
  isFeatured: boolean
  sortOrder: number
  expiryDate: string | null
  bestBeforeDate: string | null
  category: { id: string; name: string }
  substituteProduct?: { id: string; name: string } | null
}

const emptyProduct = {
  name: '',
  categoryId: '',
  description: '',
  price: '',
  vatRate: '0',
  vatRateCustom: '', // When non-empty, used instead of the preset select
  isHfss: false,
  isAgeRestricted: false,
  minimumAge: '0',
  imageUrl: '',
  barcode: '',
  unit: 'each',
  weightKg: '',
  aisle: '',
  minStockThreshold: '5',
  substituteProductId: '',
  isAvailable: true,
  stockQuantity: '0',
  isFeatured: false,
  sortOrder: '0',
  expiryDate: '',
  bestBeforeDate: '',
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [total, setTotal] = useState(0)

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyProduct)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterCategory !== 'all') params.set('category', filterCategory)
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)

      const res = await apiFetch(`/api/admin/products?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProducts(data.products)
      setTotal(data.total)
    } catch (err: any) {
      // 401 already redirects to login — only show toast for other errors
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to load products')
      }
    } finally {
      setLoading(false)
    }
  }, [search, filterCategory, sortBy, sortOrder])

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/api/admin/categories')
      if (!res.ok) return
      const data = await res.json()
      setCategories(data.categories.map((c: any) => ({ id: c.id, name: c.name })))
    } catch {}
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleOpenCreate = () => {
    setEditingId(null)
    setForm(emptyProduct)
    setDialogOpen(true)
  }

  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id)
    // Detect custom VAT rate (not one of the standard presets)
    const standardRates = ['0', '0.05', '0.2']
    const vatStr = String(p.vatRate)
    const isCustomVat = !standardRates.includes(vatStr)
    setForm({
      name: p.name,
      categoryId: p.category.id,
      description: p.description || '',
      price: String(p.price),
      vatRate: isCustomVat ? 'custom' : vatStr,
      vatRateCustom: isCustomVat ? vatStr : '',
      isHfss: p.isHfss,
      isAgeRestricted: p.isAgeRestricted,
      minimumAge: String(p.minimumAge || 0),
      imageUrl: p.imageUrl || '',
      barcode: p.barcode || '',
      unit: p.unit,
      weightKg: p.weightKg ? String(p.weightKg) : '',
      aisle: p.aisle || '',
      minStockThreshold: String(p.minStockThreshold ?? 5),
      substituteProductId: p.substituteProductId || '',
      isAvailable: p.isAvailable,
      stockQuantity: String(p.stockQuantity),
      isFeatured: p.isFeatured,
      sortOrder: String(p.sortOrder),
      expiryDate: p.expiryDate ? p.expiryDate.split('T')[0] : '',
      bestBeforeDate: p.bestBeforeDate ? p.bestBeforeDate.split('T')[0] : '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.categoryId || !form.price) {
      toast.error('Name, category, and price are required')
      return
    }
    // Resolve final VAT rate: custom input takes precedence over select
    const finalVatRate = form.vatRate === 'custom'
      ? (form.vatRateCustom || '0')
      : form.vatRate

    setSaving(true)
    try {
      const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products'
      const method = editingId ? 'PATCH' : 'POST'
      const payload = { ...form, vatRate: finalVatRate }
      // Don't send vatRateCustom to backend — backend only knows vatRate
      const { vatRateCustom, ...bodyToSend } = payload
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyToSend),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success(editingId ? 'Product updated' : 'Product created')
      setDialogOpen(false)
      fetchProducts()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to save product')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/admin/products/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success('Product deleted')
      setDeleteId(null)
      fetchProducts()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to delete product')
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleToggle = async (id: string, field: 'isAvailable' | 'isHfss' | 'isAgeRestricted', value: boolean) => {
    try {
      const res = await apiFetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${field === 'isAvailable' ? 'Availability' : 'HFSS flag'} updated`)
      fetchProducts()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to update')
      }
    }
  }

  const toggleSort = (field: 'name' | 'price' | 'stock') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const handleExportPdf = async () => {
    if (products.length === 0) {
      toast.error('No products to export')
      return
    }
    try {
      await exportTableToPdf({
        title: 'Products',
        subtitle: `${total} product${total === 1 ? '' : 's'}`,
        filename: `products-${new Date().toISOString().split('T')[0]}.pdf`,
        columns: ['Name', 'Category', 'Price', 'VAT', 'Stock', 'Available', 'Expiry', 'HFSS', 'Age 18+'],
        rows: products.map((p) => [
          p.name,
          p.category?.name || '—',
          formatPrice(p.price),
          getVatRateLabel(p.vatRate),
          p.stockQuantity,
          p.isAvailable ? 'Yes' : 'No',
          p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-GB') : '—',
          p.isHfss ? 'Yes' : 'No',
          p.isAgeRestricted ? 'Yes' : 'No',
        ]),
        footer: `Total inventory value: ${formatPrice(products.reduce((s, p) => s + p.price * p.stockQuantity, 0))}`,
      })
      toast.success('PDF exported')
    } catch {
      toast.error('Failed to export PDF')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 text-sm">{total} products total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={products.length === 0}
            className="border-gray-300"
          >
            <FileDown className="h-4 w-4 mr-1" /> Export PDF
          </Button>
          <Button onClick={handleOpenCreate} className="bg-[#16a34a] hover:bg-[#15803d]">
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
        </div>
      </div>

      {/* CSV Import/Export */}
      <div className="mb-6">
        <CsvImportExport />
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No products found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">
                        <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-700">
                          Name <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Category</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">
                        <button onClick={() => toggleSort('price')} className="flex items-center gap-1 hover:text-gray-700">
                          Price <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">VAT</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">HFSS</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">
                        <button onClick={() => toggleSort('stock')} className="flex items-center gap-1 hover:text-gray-700">
                          Stock <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Available</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{p.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-xs">{p.category.name}</Badge>
                        </td>
                        <td className="py-3 px-4">{formatPrice(p.price)}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{getVatRateLabel(p.vatRate)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleToggle(p.id, 'isHfss', !p.isHfss)}>
                              {p.isHfss ? (
                                <ToggleRight className="h-5 w-5 text-amber-500" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-gray-300" />
                              )}
                            </button>
                            <button onClick={() => handleToggle(p.id, 'isAgeRestricted', !p.isAgeRestricted)}>
                              {p.isAgeRestricted ? (
                                <ToggleRight className="h-5 w-5 text-red-500" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-gray-300" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={p.stockQuantity <= 5 ? 'text-red-600 font-medium' : ''}>
                            {p.stockQuantity}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => handleToggle(p.id, 'isAvailable', !p.isAvailable)}>
                            {p.isAvailable ? (
                              <ToggleRight className="h-5 w-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-300" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => { setDeleteId(p.id); setDeleteName(p.name) }}
                            >
                              <Trash2 className="h-4 w-4" />
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
                {products.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <Badge variant="secondary" className="text-xs mt-1">{p.category.name}</Badge>
                        </div>
                        <span className={`text-sm ${p.stockQuantity <= 5 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          Stock: {p.stockQuantity}
                        </span>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Price</span>
                          <span className="font-medium">{formatPrice(p.price)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">VAT Rate</span>
                          <span className="font-medium">{getVatRateLabel(p.vatRate)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggle(p.id, 'isAvailable', !p.isAvailable)}
                            className="flex items-center gap-1.5 min-h-[44px]"
                          >
                            {p.isAvailable ? (
                              <ToggleRight className="h-5 w-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-300" />
                            )}
                            <span className="text-sm">Available</span>
                          </button>
                          <button
                            onClick={() => handleToggle(p.id, 'isHfss', !p.isHfss)}
                            className="flex items-center gap-1.5 min-h-[44px]"
                          >
                            {p.isHfss ? (
                              <ToggleRight className="h-5 w-5 text-amber-500" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-300" />
                            )}
                            <span className="text-sm">HFSS</span>
                          </button>
                          <button
                            onClick={() => handleToggle(p.id, 'isAgeRestricted', !p.isAgeRestricted)}
                            className="flex items-center gap-1.5 min-h-[44px]"
                          >
                            {p.isAgeRestricted ? (
                              <ToggleRight className="h-5 w-5 text-red-500" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-300" />
                            )}
                            <span className="text-sm">Age 18+</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" className="flex-1 min-h-10" onClick={() => handleOpenEdit(p)}>
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 min-h-10 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => { setDeleteId(p.id); setDeleteName(p.name) }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoryId">Category *</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Price (£) *</Label>
                <Input id="price" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vatRate">VAT Rate</Label>
                <Select value={form.vatRate} onValueChange={(v) => setForm({ ...form, vatRate: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Zero-rated (0%)</SelectItem>
                    <SelectItem value="0.05">Reduced (5%)</SelectItem>
                    <SelectItem value="0.2">Standard (20%)</SelectItem>
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {form.vatRate === 'custom' && (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={form.vatRateCustom}
                      onChange={(e) => setForm({ ...form, vatRateCustom: e.target.value })}
                      placeholder="e.g., 0.125 for 12.5%"
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">decimal (0–1)</span>
                  </div>
                )}
                {form.vatRate === 'custom' && form.vatRateCustom && (
                  <p className="text-xs text-gray-500">
                    = {Math.round(parseFloat(form.vatRateCustom || '0') * 100)}% VAT
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
                <p className="text-xs text-gray-500">Hard expiry — unsafe to sell after this date. Auto-moves to wastage.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bestBeforeDate">Best Before Date</Label>
                <Input
                  id="bestBeforeDate"
                  type="date"
                  value={form.bestBeforeDate}
                  onChange={(e) => setForm({ ...form, bestBeforeDate: e.target.value })}
                />
                <p className="text-xs text-gray-500">Advisory — quality degrades but still saleable.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stockQuantity">Stock Quantity</Label>
                <Input id="stockQuantity" type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="each">Each</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="litre">Litre</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                    <SelectItem value="bunch">Bunch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="weightKg">Weight (kg)</Label>
                <Input id="weightKg" type="number" step="0.01" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input id="barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="aisle">Aisle</Label>
                <Input id="aisle" placeholder="e.g., A1" value={form.aisle} onChange={(e) => setForm({ ...form, aisle: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="minStockThreshold">Min Stock Threshold</Label>
                <Input id="minStockThreshold" type="number" min="0" value={form.minStockThreshold} onChange={(e) => setForm({ ...form, minStockThreshold: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="imageUrl">Product Image</Label>
              <div className="flex items-start gap-3">
                {(form.imageUrl && form.imageUrl.startsWith('data:')) && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                    <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <Input id="imageUrl" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Image URL or upload below" />
                  <div className="mt-2">
                    <label htmlFor="imageUpload" className="cursor-pointer">
                      <div className="inline-flex items-center gap-2 text-sm text-[#16a34a] hover:text-[#15803d] font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Upload Image (max 2MB)
                      </div>
                      <input
                        type="file"
                        id="imageUpload"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const { validateImageFile, fileToDataUrl } = await import('@/lib/upload')
                          const err = validateImageFile(file)
                          if (err) { toast.error(err); return }
                          try {
                            const dataUrl = await fileToDataUrl(file)
                            setForm({ ...form, imageUrl: dataUrl })
                          } catch { toast.error('Failed to process image') }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            {editingId && (
              <div className="grid gap-2">
                <Label>Substitute Product</Label>
                <Select value={form.substituteProductId || '_none'} onValueChange={(v) => setForm({ ...form, substituteProductId: v === '_none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="No substitute" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No substitute</SelectItem>
                    {products
                      .filter((p) => p.id !== editingId && p.category.id === form.categoryId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Select an alternative product from the same category</p>
              </div>
            )}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.isAvailable} onCheckedChange={(v) => setForm({ ...form, isAvailable: v })} />
                <Label>Available</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isHfss} onCheckedChange={(v) => setForm({ ...form, isHfss: v })} />
                <Label>HFSS (High in Fat, Salt, Sugar)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isAgeRestricted} onCheckedChange={(v) => setForm({ ...form, isAgeRestricted: v, minimumAge: v ? '18' : '0' })} />
                <Label>Age Restricted (Challenge 25)</Label>
              </div>
              {form.isAgeRestricted && (
                <div className="space-y-1">
                  <Label htmlFor="minimumAge">Minimum Age</Label>
                  <Select value={form.minimumAge} onValueChange={(v) => setForm({ ...form, minimumAge: v })}>
                    <SelectTrigger id="minimumAge">
                      <SelectValue placeholder="Select minimum age" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16">16+ (Energy drinks)</SelectItem>
                      <SelectItem value="18">18+ (Alcohol, Tobacco, Knives, Solvents)</SelectItem>
                      <SelectItem value="21">21+ (US-restricted items)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} />
                <Label>Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#16a34a] hover:bg-[#15803d]">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
