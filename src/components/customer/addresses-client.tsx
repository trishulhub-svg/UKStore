'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Star,
  Home,
  Building2,
  Briefcase,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'

interface Address {
  id: string
  label: string | null
  addressLine1: string
  addressLine2: string | null
  city: string
  postcode: string
  isDefault: boolean
}

const labelIcons: Record<string, React.ReactNode> = {
  Home: <Home className="h-4 w-4" />,
  Work: <Briefcase className="h-4 w-4" />,
  Other: <Building2 className="h-4 w-4" />,
}

export function AddressesClient() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [label, setLabel] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/user/addresses')
      if (res.ok) {
        const data = await res.json()
        setAddresses(data.addresses || [])
      }
    } catch (err) {
      console.error('Failed to fetch addresses:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAddresses()
  }, [])

  const resetForm = () => {
    setLabel('')
    setAddressLine1('')
    setAddressLine2('')
    setCity('')
    setPostcode('')
    setIsDefault(false)
    setEditingId(null)
  }

  const openEditDialog = (address: Address) => {
    setEditingId(address.id)
    setLabel(address.label || '')
    setAddressLine1(address.addressLine1)
    setAddressLine2(address.addressLine2 || '')
    setCity(address.city)
    setPostcode(address.postcode)
    setIsDefault(address.isDefault)
    setDialogOpen(true)
  }

  const openAddDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!addressLine1 || !city || !postcode) return

    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/user/addresses/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, addressLine1, addressLine2, city, postcode, isDefault }),
        })
        if (res.ok) {
          await fetchAddresses()
          setDialogOpen(false)
          resetForm()
        }
      } else {
        const res = await fetch('/api/user/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, addressLine1, addressLine2, city, postcode, isDefault }),
        })
        if (res.ok) {
          await fetchAddresses()
          setDialogOpen(false)
          resetForm()
        }
      }
    } catch (err) {
      console.error('Failed to save address:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return

    try {
      const res = await fetch(`/api/user/addresses/${addressId}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchAddresses()
      }
    } catch (err) {
      console.error('Failed to delete address:', err)
    }
  }

  const handleSetDefault = async (addressId: string) => {
    try {
      const res = await fetch(`/api/user/addresses/${addressId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (res.ok) {
        await fetchAddresses()
      }
    } catch (err) {
      console.error('Failed to set default address:', err)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Addresses</h1>
          <p className="text-sm text-gray-500">Manage your delivery addresses</p>
        </div>
      </div>

      {/* Address List */}
      {addresses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600">No saved addresses</p>
            <p className="text-sm text-gray-400 mt-1">Add your first delivery address</p>
            <Button
              onClick={openAddDialog}
              className="mt-4 bg-[#16a34a] hover:bg-[#15803d] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <Card key={address.id} className={`shadow-sm ${address.isDefault ? 'border-[#16a34a]/30 bg-green-50/30' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {labelIcons[address.label || 'Home'] || <MapPin className="h-5 w-5 text-gray-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {address.label && (
                          <span className="font-semibold text-sm text-gray-900">{address.label}</span>
                        )}
                        {address.isDefault && (
                          <Badge className="bg-[#16a34a]/10 text-[#16a34a] text-[10px] border-0">
                            <Star className="h-3 w-3 mr-0.5" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{address.addressLine1}</p>
                      {address.addressLine2 && (
                        <p className="text-sm text-gray-600">{address.addressLine2}</p>
                      )}
                      <p className="text-sm text-gray-600">{address.city} {address.postcode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!address.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(address.id)}
                        className="h-8 w-8 text-gray-400 hover:text-[#16a34a]"
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(address)}
                      className="h-8 w-8 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(address.id)}
                      className="h-8 w-8 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Address Button */}
      {addresses.length > 0 && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button
              onClick={openAddDialog}
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Address
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Address' : 'Add New Address'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Label</Label>
                <div className="flex gap-2 mt-1">
                  {['Home', 'Work', 'Other'].map((l) => (
                    <Button
                      key={l}
                      variant={label === l ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLabel(l)}
                      className={label === l ? 'bg-[#16a34a] hover:bg-[#15803d] text-white' : ''}
                    >
                      {labelIcons[l]}
                      <span className="ml-1 text-xs">{l}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="addressLine1">Address Line 1 *</Label>
                <Input
                  id="addressLine1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. 123 High Street"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Flat, suite, etc."
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="London"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="postcode">Postcode *</Label>
                  <Input
                    id="postcode"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    placeholder="SW1A 1AA"
                    className="mt-1 uppercase"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-gray-300 text-[#16a34a] focus:ring-[#16a34a]"
                />
                <Label htmlFor="isDefault" className="text-sm">Set as default address</Label>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setDialogOpen(false); resetForm() }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!addressLine1 || !city || !postcode || saving}
                  className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add Address'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Show dialog for adding when no addresses exist */}
      {addresses.length === 0 && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Address</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Label</Label>
                <div className="flex gap-2 mt-1">
                  {['Home', 'Work', 'Other'].map((l) => (
                    <Button
                      key={l}
                      variant={label === l ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLabel(l)}
                      className={label === l ? 'bg-[#16a34a] hover:bg-[#15803d] text-white' : ''}
                    >
                      {labelIcons[l]}
                      <span className="ml-1 text-xs">{l}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="addrLine1">Address Line 1 *</Label>
                <Input id="addrLine1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="e.g. 123 High Street" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="addrLine2">Address Line 2</Label>
                <Input id="addrLine2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Flat, suite, etc." className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cityField">City *</Label>
                  <Input id="cityField" value={city} onChange={(e) => setCity(e.target.value)} placeholder="London" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="pcField">Postcode *</Label>
                  <Input id="pcField" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="SW1A 1AA" className="mt-1 uppercase" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="defCheck" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded border-gray-300 text-[#16a34a] focus:ring-[#16a34a]" />
                <Label htmlFor="defCheck" className="text-sm">Set as default address</Label>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} disabled={!addressLine1 || !city || !postcode || saving} className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white">
                  {saving ? 'Saving...' : 'Add Address'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
