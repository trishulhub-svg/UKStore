'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ImagePlus, Trash2, Save, Loader2, GripVertical, Eye, EyeOff, Star, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

interface Banner {
  id: string
  title: string | null
  imageUrl: string
  linkUrl: string | null
  linkCategory: string | null
  sortOrder: number
  isActive: boolean
}

interface Category {
  id: string
  name: string
  slug: string
}

interface StoreDefaults {
  defaultBanner1Url: string | null
  defaultBanner2Url: string | null
}

const BANNER_SLOTS = 4

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [storeDefaults, setStoreDefaults] = useState<StoreDefaults>({ defaultBanner1Url: null, defaultBanner2Url: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const defaultFileInputRefs = useRef<Record<1 | 2, HTMLInputElement | null>>({})

  const fetchBanners = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/banners')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBanners(data.banners || [])
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to load banners')
      }

    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/categories')
      if (!res.ok) return
      const data = await res.json()
      setCategories(data.categories || [])
    } catch {
      // Non-critical
    }
  }, [])

  const fetchStoreDefaults = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/store/profile')
      if (!res.ok) return
      const data = await res.json()
      setStoreDefaults({
        defaultBanner1Url: data.store?.defaultBanner1Url || null,
        defaultBanner2Url: data.store?.defaultBanner2Url || null,
      })
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    fetchBanners()
    fetchCategories()
    fetchStoreDefaults()
  }, [fetchBanners, fetchCategories, fetchStoreDefaults])

  const handleImageUpload = (slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      updateBannerField(slotIndex, 'imageUrl', base64)
    }
    reader.readAsDataURL(file)
  }

  const handleDefaultImageUpload = (slot: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setStoreDefaults((prev) => ({
        ...prev,
        [slot === 1 ? 'defaultBanner1Url' : 'defaultBanner2Url']: base64,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveDefault = async (slot: 1 | 2) => {
    const url = slot === 1 ? storeDefaults.defaultBanner1Url : storeDefaults.defaultBanner2Url
    if (!url) {
      toast.error('Please upload an image first')
      return
    }
    setSaving(`default-${slot}`)
    try {
      const res = await apiFetch('/api/admin/store/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [slot === 1 ? 'defaultBanner1Url' : 'defaultBanner2Url']: url,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Default banner ${slot} saved`)
      fetchStoreDefaults()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to save default banner')
      }

    } finally {
      setSaving(null)
    }
  }

  const getOrCreateBanner = (slotIndex: number): Banner => {
    const existing = banners.find((b) => b.sortOrder === slotIndex)
    if (existing) return existing
    return {
      id: `new-${slotIndex}`,
      title: null,
      imageUrl: '',
      linkUrl: null,
      linkCategory: null,
      sortOrder: slotIndex,
      isActive: true,
    }
  }

  const updateBannerField = (slotIndex: number, field: string, value: unknown) => {
    setBanners((prev) => {
      const existing = prev.find((b) => b.sortOrder === slotIndex)
      if (existing) {
        return prev.map((b) => (b.sortOrder === slotIndex ? { ...b, [field]: value } : b))
      }
      return [
        ...prev,
        {
          id: `new-${slotIndex}`,
          title: null,
          imageUrl: '',
          linkUrl: null,
          linkCategory: null,
          sortOrder: slotIndex,
          isActive: true,
          [field]: value,
        },
      ]
    })
  }

  const handleSave = async (slotIndex: number) => {
    const banner = getOrCreateBanner(slotIndex)
    if (!banner.imageUrl) {
      toast.error('Please upload an image for this banner')
      return
    }

    setSaving(banner.id)
    try {
      const isNew = banner.id.startsWith('new-')
      const url = isNew ? '/api/admin/banners' : `/api/admin/banners/${banner.id}`
      const method = isNew ? 'POST' : 'PATCH'

      const body: Record<string, unknown> = {
        title: banner.title || null,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl || null,
        linkCategory: banner.linkCategory || null,
        sortOrder: slotIndex,
        isActive: banner.isActive,
      }

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error()

      toast.success(`Banner ${slotIndex + 1} saved successfully`)
      fetchBanners()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to save banner')
      }

    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (bannerId: string) => {
    if (bannerId.startsWith('new-')) {
      setBanners((prev) => prev.filter((b) => b.id !== bannerId))
      return
    }

    try {
      const res = await apiFetch(`/api/admin/banners/${bannerId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Banner deleted')
      fetchBanners()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to delete banner')
      }

    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
        <p className="text-gray-500 text-sm">Default banners + promotional carousel banners ({BANNER_SLOTS} slots)</p>
      </div>

      {/* Default Banners Section */}
      <Card className="mb-8 border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-blue-500" />
            Default Banner Images
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            These two images are shown on the customer homepage when no promotional or normal banners are uploaded.
            They cannot be deleted, but you can replace them with new images anytime.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {([1, 2] as const).map((slot) => {
              const url = slot === 1 ? storeDefaults.defaultBanner1Url : storeDefaults.defaultBanner2Url
              return (
                <div key={slot} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700">
                      Default Banner {slot}
                    </Label>
                    <Badge className="text-xs bg-blue-100 text-blue-700">Default · Not deletable</Badge>
                  </div>

                  {url ? (
                    <div className="relative group rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={url}
                        alt={`Default banner ${slot}`}
                        className="w-full h-32 sm:h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => defaultFileInputRefs.current[slot]?.click()}
                        >
                          <ImagePlus className="h-4 w-4 mr-1" /> Replace
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      onClick={() => defaultFileInputRefs.current[slot]?.click()}
                    >
                      <ImagePlus className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Click to upload default banner {slot}</p>
                      <p className="text-xs text-gray-400 mt-1">Recommended: 1200×400px, max 5MB</p>
                    </div>
                  )}
                  <input
                    ref={(el) => { defaultFileInputRefs.current[slot] = el }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleDefaultImageUpload(slot, e)}
                  />

                  {url && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => defaultFileInputRefs.current[slot]?.click()}
                      >
                        <ImagePlus className="h-3.5 w-3.5 mr-1" /> Replace Image
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveDefault(slot)}
                        disabled={saving === `default-${slot}`}
                        className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white"
                      >
                        {saving === `default-${slot}` ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving...</>
                        ) : (
                          <><Save className="h-3.5 w-3.5 mr-1" /> Save</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">How default banners work:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Default banners show on the customer homepage only when no promotional banners are active.</li>
                <li>They cannot be deleted — only replaced with new images.</li>
                <li>Promotional banners (below) take priority when active.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Promotional / Carousel Banners */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">Promotional Banners</h2>
        <p className="text-sm text-gray-500">Up to {BANNER_SLOTS} banner slots for the homepage carousel</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from({ length: BANNER_SLOTS }, (_, i) => {
            const banner = getOrCreateBanner(i)
            const isNew = banner.id.startsWith('new-')

            return (
              <Card key={i} className={!banner.isActive ? 'opacity-60' : ''}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      Banner Slot {i + 1}
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={banner.isActive}
                          onCheckedChange={(checked) => updateBannerField(i, 'isActive', checked)}
                        />
                        <Label className="text-sm text-gray-600 flex items-center gap-1">
                          {banner.isActive ? (
                            <><Eye className="h-3.5 w-3.5 text-green-600" /> Active</>
                          ) : (
                            <><EyeOff className="h-3.5 w-3.5 text-gray-400" /> Inactive</>
                          )}
                        </Label>
                      </div>
                      {!isNew && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(banner.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Image Upload */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Banner Image
                    </Label>
                    {banner.imageUrl ? (
                      <div className="relative group rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={banner.imageUrl}
                          alt={banner.title || `Banner ${i + 1}`}
                          className="w-full h-40 sm:h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              updateBannerField(i, 'imageUrl', '')
                            }}
                          >
                            <ImagePlus className="h-4 w-4 mr-1" /> Replace
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#16a34a] hover:bg-gray-50 transition-colors"
                        onClick={() => fileInputRefs.current[i]?.click()}
                      >
                        <ImagePlus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Click to upload banner image</p>
                        <p className="text-xs text-gray-400 mt-1">Recommended: 1200×400px, max 5MB</p>
                      </div>
                    )}
                    <input
                      ref={(el) => { fileInputRefs.current[i] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(i, e)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Title */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                        Banner Title (optional)
                      </Label>
                      <Input
                        placeholder="e.g., Summer Sale 20% Off"
                        value={banner.title || ''}
                        onChange={(e) => updateBannerField(i, 'title', e.target.value)}
                      />
                    </div>

                    {/* Link Category */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                        Link to Category
                      </Label>
                      <Select
                        value={banner.linkCategory || '_none'}
                        onValueChange={(val) =>
                          updateBannerField(i, 'linkCategory', val === '_none' ? null : val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">No link</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.slug}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Custom Link URL (advanced) */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      Custom Link URL (overrides category)
                    </Label>
                    <Input
                      placeholder="e.g., /catalog?category=dairy-eggs"
                      value={banner.linkUrl || ''}
                      onChange={(e) => updateBannerField(i, 'linkUrl', e.target.value)}
                    />
                  </div>

                  <Separator />

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleSave(i)}
                      disabled={saving === banner.id}
                      className="bg-[#16a34a] hover:bg-[#15803d] text-white"
                    >
                      {saving === banner.id ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="h-4 w-4 mr-1.5" /> Save Banner {i + 1}</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
