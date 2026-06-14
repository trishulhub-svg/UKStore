'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, MapPin, AlertTriangle } from 'lucide-react'
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

interface DeliveryZone {
  id: string
  name: string
  postcodes: string
  deliveryFee: number
  minimumOrder: number
  isActive: boolean
  createdAt: string
}

const emptyForm = {
  name: '',
  postcodes: '[]',
  deliveryFee: '0',
  minimumOrder: '0',
  isActive: true,
}

export default function AdminDeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/delivery-zones')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setZones(data.zones)
    } catch {
      toast.error('Failed to load delivery zones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchZones()
  }, [fetchZones])

  const handleOpenCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const handleOpenEdit = (z: DeliveryZone) => {
    setEditingId(z.id)
    setForm({
      name: z.name,
      postcodes: z.postcodes,
      deliveryFee: String(z.deliveryFee),
      minimumOrder: String(z.minimumOrder),
      isActive: z.isActive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const url = editingId ? `/api/admin/delivery-zones/${editingId}` : '/api/admin/delivery-zones'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success(editingId ? 'Delivery zone updated' : 'Delivery zone created')
      setDialogOpen(false)
      fetchZones()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save delivery zone')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/delivery-zones/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success('Delivery zone deleted')
      setDeleteId(null)
      fetchZones()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete delivery zone')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (id: string, value: boolean) => {
    try {
      const res = await fetch(`/api/admin/delivery-zones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: value }),
      })
      if (!res.ok) throw new Error()
      toast.success('Zone status updated')
      fetchZones()
    } catch {
      toast.error('Failed to update zone')
    }
  }

  const parsePostcodes = (json: string): string[] => {
    try {
      return JSON.parse(json)
    } catch {
      return []
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Zones</h1>
          <p className="text-gray-500 text-sm">{zones.length} zones</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-[#16a34a] hover:bg-[#15803d]">
          <Plus className="h-4 w-4 mr-1" /> Add Zone
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : zones.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No delivery zones yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((z) => {
            const postcodes = parsePostcodes(z.postcodes)
            return (
              <Card key={z.id} className="relative">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{z.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => handleToggleActive(z.id, !z.isActive)}>
                          {z.isActive ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-gray-300" />
                          )}
                        </button>
                        <span className="text-xs text-gray-500">{z.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(z)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => { setDeleteId(z.id); setDeleteName(z.name) }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-gray-500 text-xs">Delivery Fee</p>
                      <p className="font-medium">{formatPrice(z.deliveryFee)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Min. Order</p>
                      <p className="font-medium">{formatPrice(z.minimumOrder)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Postcodes</p>
                    <div className="flex flex-wrap gap-1">
                      {postcodes.slice(0, 8).map((pc) => (
                        <Badge key={pc} variant="secondary" className="text-xs">{pc}</Badge>
                      ))}
                      {postcodes.length > 8 && (
                        <Badge variant="outline" className="text-xs">+{postcodes.length - 8}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Delivery Zone' : 'Add Delivery Zone'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Central London" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="postcodes">Postcodes (JSON array)</Label>
              <Textarea
                id="postcodes"
                value={form.postcodes}
                onChange={(e) => setForm({ ...form, postcodes: e.target.value })}
                placeholder='["SE1", "SE2", "SW1", "EC1"]'
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500">Enter as JSON array of postcode prefixes</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="deliveryFee">Delivery Fee (£)</Label>
                <Input id="deliveryFee" type="number" step="0.01" value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="minimumOrder">Minimum Order (£)</Label>
                <Input id="minimumOrder" type="number" step="0.01" value={form.minimumOrder} onChange={(e) => setForm({ ...form, minimumOrder: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>Active</Label>
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
            <AlertDialogTitle>Delete Delivery Zone</AlertDialogTitle>
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
