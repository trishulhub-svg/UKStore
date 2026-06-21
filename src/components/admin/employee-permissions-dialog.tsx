'use client'

import { useEffect, useState } from 'react'
import { Loader2, Shield, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

interface FeatureCatalogEntry {
  key: string
  label: string
  description: string
  appliesTo: string[]
  group: string
}

interface EmployeePermissionsDialogProps {
  employee: {
    id: string
    name: string | null
    email: string
    role: string
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmployeePermissionsDialog({
  employee,
  open,
  onOpenChange,
}: EmployeePermissionsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [catalog, setCatalog] = useState<FeatureCatalogEntry[]>([])
  const [features, setFeatures] = useState<string[] | null>(null) // null = full access
  const [useRestrictions, setUseRestrictions] = useState(false)

  useEffect(() => {
    if (!open || !employee) return
    setLoading(true)
    setFeatures(null)
    setCatalog([])
    setUseRestrictions(false)
    ;(async () => {
      try {
        const res = await apiFetch(`/api/admin/employees/${employee.id}/permissions`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setCatalog(data.catalog || [])
        if (data.features === null) {
          setFeatures(null)
          setUseRestrictions(false)
        } else {
          setFeatures(data.features)
          setUseRestrictions(true)
        }
      } catch (err: any) {
        if (err?.message !== 'Session expired — redirecting to login') {
          toast.error('Failed to load permissions')
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [open, employee])

  const handleToggleFeature = (key: string, checked: boolean) => {
    if (features === null) return
    if (checked) {
      setFeatures([...features, key])
    } else {
      setFeatures(features.filter((f) => f !== key))
    }
  }

  const handleSelectAll = () => {
    if (catalog.length === 0) return
    setFeatures(catalog.map((c) => c.key))
  }

  const handleDeselectAll = () => {
    setFeatures([])
  }

  const handleSave = async () => {
    if (!employee) return
    setSaving(true)
    try {
      const payload = useRestrictions ? features : null
      const res = await apiFetch(`/api/admin/employees/${employee.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: payload }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      toast.success(`Permissions updated for ${employee.name || employee.email}`)
      onOpenChange(false)
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to update permissions')
      }
    } finally {
      setSaving(false)
    }
  }

  // Group catalog by group
  const groupedCatalog = catalog.reduce((acc, entry) => {
    if (!acc[entry.group]) acc[entry.group] = []
    acc[entry.group].push(entry)
    return acc
  }, {} as Record<string, FeatureCatalogEntry[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#16a34a]" />
            Feature Permissions
          </DialogTitle>
          <DialogDescription>
            Choose which features <strong>{employee?.name || employee?.email}</strong> can access.
            The store owner always has full access and cannot be restricted.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : employee?.role.toUpperCase() === 'OWNER' ? (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 flex items-start gap-2">
            <ShieldCheck className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Owner account</p>
              <p className="mt-1">The owner always has full access to every feature and cannot be restricted.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Access mode toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Access Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUseRestrictions(false)
                    setFeatures(null)
                  }}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                    !useRestrictions
                      ? 'border-[#16a34a] bg-[#16a34a]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <ShieldCheck className={`h-5 w-5 flex-shrink-0 ${!useRestrictions ? 'text-[#16a34a]' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Full Access</p>
                    <p className="text-xs text-gray-500 mt-0.5">All features enabled (default)</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseRestrictions(true)
                    if (features === null) {
                      // Default: enable all features when first switching to restricted mode
                      setFeatures(catalog.map((c) => c.key))
                    }
                  }}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                    useRestrictions
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <ShieldOff className={`h-5 w-5 flex-shrink-0 ${useRestrictions ? 'text-amber-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Restricted Access</p>
                    <p className="text-xs text-gray-500 mt-0.5">Pick specific features below</p>
                  </div>
                </button>
              </div>
            </div>

            {useRestrictions && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {features?.length || 0} of {catalog.length} features enabled
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll}>
                      Select All
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleDeselectAll}>
                      Clear All
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Feature groups */}
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                  {Object.entries(groupedCatalog).map(([group, entries]) => (
                    <div key={group} className="space-y-2">
                      <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{group}</h4>
                      <div className="space-y-2">
                        {entries.map((entry) => {
                          const checked = features?.includes(entry.key) || false
                          return (
                            <label
                              key={entry.key}
                              htmlFor={`feat-${entry.key}`}
                              className="flex items-start gap-3 rounded-md border border-gray-200 p-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              <Checkbox
                                id={`feat-${entry.key}`}
                                checked={checked}
                                onCheckedChange={(v) => handleToggleFeature(entry.key, v === true)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-gray-900">{entry.label}</p>
                                  {checked ? (
                                    <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50">On</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] text-gray-500">Off</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {features?.length === 0 && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    No features selected — this employee will not be able to access any features. They will still be able to log in to view their profile only.
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#16a34a] hover:bg-[#15803d] text-white"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...</>
                ) : (
                  'Save Permissions'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
