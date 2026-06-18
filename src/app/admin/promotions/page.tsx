'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'
import { apiFetch } from '@/lib/api-fetch'

interface Category {
  id: string
  name: string
}

interface Promotion {
  id: string
  name: string
  description: string | null
  discountType: string
  discountValue: number
  startDate: string
  endDate: string
  appliesToCategoryIds: string | null
  excludesHfss: boolean
  isActive: boolean
  code: string | null
  createdAt: string
}

const emptyForm = {
  name: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  startDate: '',
  endDate: '',
  appliesToCategoryIds: '',
  excludesHfss: false,
  isActive: true,
  code: '',
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const fetchPromotions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/promotions')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPromotions(data.promotions)
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to load promotions')
      }

    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/api/admin/categories')
      if (!res.ok) return
      const data = await res.json()
      setCategories(data.categories.map((c: any) => ({ id: c.id, name: c.name })))
    } catch {}
  }

  useEffect(() => {
    fetchPromotions()
    fetchCategories()
  }, [fetchPromotions])

  const handleOpenCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const handleOpenEdit = (p: Promotion) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description || '',
      discountType: p.discountType,
      discountValue: String(p.discountValue),
      startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      endDate: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : '',
      appliesToCategoryIds: p.appliesToCategoryIds || '',
      excludesHfss: p.excludesHfss,
      isActive: p.isActive,
      code: p.code || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.discountValue || !form.startDate || !form.endDate) {
      toast.error('Name, discount value, start and end dates are required')
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/admin/promotions/${editingId}` : '/api/admin/promotions'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success(editingId ? 'Promotion updated' : 'Promotion created')
      setDialogOpen(false)
      fetchPromotions()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to save promotion')
      }

    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/admin/promotions/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success('Promotion deleted')
      setDeleteId(null)
      fetchPromotions()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to delete promotion')
      }

    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (id: string, value: boolean) => {
    try {
      const res = await apiFetch(`/api/admin/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: value }),
      })
      if (!res.ok) throw new Error()
      toast.success('Promotion status updated')
      fetchPromotions()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to update promotion')
      }

    }
  }

  const isActive = (p: Promotion) => {
    const now = new Date()
    const start = new Date(p.startDate)
    const end = new Date(p.endDate)
    return p.isActive && now >= start && now <= end
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="text-gray-500 text-sm">{promotions.length} promotions</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-[#16a34a] hover:bg-[#15803d]">
          <Plus className="h-4 w-4 mr-1" /> Add Promotion
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : promotions.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No promotions yet</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Value</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Dates</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">HFSS</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Active</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotions.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{p.name}</p>
                            {p.code && (
                              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{p.code}</code>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {p.discountType === 'percentage' ? '% Off' : '£ Off'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          {p.discountType === 'percentage'
                            ? `${p.discountValue}%`
                            : formatPrice(p.discountValue)}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500">
                          {new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(p.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="py-3 px-4">
                          {p.excludesHfss ? (
                            <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">Excludes</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => handleToggleActive(p.id, !p.isActive)}>
                            {p.isActive ? (
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
                {promotions.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          {p.code && (
                            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{p.code}</code>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {p.discountType === 'percentage' ? '% Off' : '£ Off'}
                        </Badge>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Value</span>
                          <span className="font-medium">
                            {p.discountType === 'percentage'
                              ? `${p.discountValue}%`
                              : formatPrice(p.discountValue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Start</span>
                          <span className="font-medium text-sm">
                            {new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">End</span>
                          <span className="font-medium text-sm">
                            {new Date(p.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">HFSS</span>
                          {p.excludesHfss ? (
                            <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">Excludes</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">Included</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => handleToggleActive(p.id, !p.isActive)}
                          className="flex items-center gap-1.5 min-h-[44px]"
                        >
                          {p.isActive ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-gray-300" />
                          )}
                          <span className="text-sm">{p.isActive ? 'Active' : 'Inactive'}</span>
                        </button>
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
            <DialogTitle>{editingId ? 'Edit Promotion' : 'Add Promotion'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Discount Type</Label>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed_amount">Fixed Amount (£)</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="discountValue">Discount Value *</Label>
                <Input
                  id="discountValue"
                  type="number"
                  step="0.01"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input id="endDate" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">Promo Code</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. SUMMER20" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="appliesToCategoryIds">Applies to Categories (JSON)</Label>
              <Input
                id="appliesToCategoryIds"
                value={form.appliesToCategoryIds}
                onChange={(e) => setForm({ ...form, appliesToCategoryIds: e.target.value })}
                placeholder='["category-id-1", "category-id-2"]'
              />
              <p className="text-xs text-gray-500">Leave empty for all categories</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.excludesHfss} onCheckedChange={(v) => setForm({ ...form, excludesHfss: v })} />
                <Label>Excludes HFSS</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label>Active</Label>
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
            <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
