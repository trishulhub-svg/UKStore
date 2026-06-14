'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ImagePlus, Trash2, Save, Loader2, GripVertical, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

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

const BANNER_SLOTS = 4

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/banners')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBanners(data.banners || [])
    } catch {
      toast.error('Failed to load banners')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories')
      if (!res.ok) return
      const data = await res.json()
      setCategories(data.categories || [])
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    fetchBanners()
    fetchCategories()
  }, [fetchBanners, fetchCategories])

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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error()

      toast.success(`Banner ${slotIndex + 1} saved successfully`)
      fetchBanners()
    } catch {
      toast.error('Failed to save banner')
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
      const res = await fetch(`/api/admin/banners/${bannerId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Banner deleted')
      fetchBanners()
    } catch {
      toast.error('Failed to delete banner')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
        <p className="text-gray-500 text-sm">Manage the homepage carousel banners ({BANNER_SLOTS} slots)</p>
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
