'use client'

/**
 * Reusable feature-permissions section for embedding inside the
 * Create/Edit Employee dialogs.
 *
 * - Used in Create: props.initialFeatures should be null (full access default)
 *   and onFeaturesChange should bubble up to the parent form so it can be
 *   POSTed together with the new user fields.
 * - Used in Edit: pass the user's current role + id so the section can
 *   fetch the current feature list and catalog from the permissions endpoint.
 *
 * OWNER role: section is hidden (owner always has full access).
 */

import { useEffect, useState } from 'react'
import { Loader2, Shield, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

interface FeatureCatalogEntry {
  key: string
  label: string
  description: string
  appliesTo: string[]
  group: string
}

interface FeaturePermissionsSectionProps {
  /** The user's role. OWNER hides the section entirely. */
  role: string
  /** For Edit mode: the user's existing id so we can fetch current permissions. Leave undefined for Create. */
  userId?: string
  /** Controlled value: null = full access, string[] = restricted to listed features. */
  features: string[] | null
  /** Callback whenever the feature list or access mode changes. */
  onFeaturesChange: (features: string[] | null) => void
  /** Compact mode for tighter embedding (smaller padding, no header). */
  compact?: boolean
}

export function FeaturePermissionsSection({
  role,
  userId,
  features,
  onFeaturesChange,
  compact = false,
}: FeaturePermissionsSectionProps) {
  const [loading, setLoading] = useState(false)
  const [catalog, setCatalog] = useState<FeatureCatalogEntry[]>([])

  const useRestrictions = features !== null

  // Fetch the catalog (and current features for Edit mode).
  //
  // Edit mode (userId provided): re-runs when userId/role changes — fetches
  // the user's current feature permissions and the full catalog.
  //
  // Create mode (no userId): only fetches the catalog. We do NOT call
  // onFeaturesChange here — the parent's initial state (null = full access)
  // is the right default, and we don't want to clobber the user's selections
  // if they change the role dropdown after picking features.
  useEffect(() => {
    if (!role || role.toUpperCase() === 'OWNER') return

    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        let catalogData: FeatureCatalogEntry[] = []

        if (userId) {
          // Edit mode — fetch catalog + current features
          const res = await apiFetch(`/api/admin/employees/${userId}/permissions`)
          if (!res.ok) throw new Error('Failed to load permissions')
          const data = await res.json()
          catalogData = data.catalog || []
          const currentFeatures: string[] | null = data.features
          if (cancelled) return
          setCatalog(catalogData)
          onFeaturesChange(currentFeatures)
        } else {
          // Create mode — fetch catalog only, do NOT touch features state
          const res = await apiFetch('/api/admin/feature-catalog')
          if (!res.ok) throw new Error('Failed to load feature catalog')
          const data = await res.json()
          catalogData = data.catalog || []
          if (cancelled) return
          setCatalog(catalogData)
        }
      } catch (err: any) {
        if (err?.message !== 'Session expired — redirecting to login') {
          toast.error('Failed to load feature catalog')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, role])

  // Hide entirely for OWNER
  if (!role || role.toUpperCase() === 'OWNER') return null

  const handleToggleFeature = (key: string, checked: boolean) => {
    if (features === null) return
    if (checked) {
      onFeaturesChange([...features, key])
    } else {
      onFeaturesChange(features.filter((f) => f !== key))
    }
  }

  const handleSelectAll = () => {
    if (catalog.length === 0) return
    onFeaturesChange(catalog.map((c) => c.key))
  }

  const handleDeselectAll = () => {
    onFeaturesChange([])
  }

  const handleSwitchToFullAccess = () => {
    onFeaturesChange(null)
  }

  const handleSwitchToRestricted = () => {
    if (features === null) {
      // Default: enable all features when first switching to restricted mode
      onFeaturesChange(catalog.map((c) => c.key))
    }
  }

  // Group catalog by group — show ALL features regardless of role.
  // Owner can grant any feature to any employee.
  const groupedCatalog = catalog.reduce((acc, entry) => {
    if (!acc[entry.group]) acc[entry.group] = []
    acc[entry.group].push(entry)
    return acc
  }, {} as Record<string, FeatureCatalogEntry[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading feature catalog…</span>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${compact ? '' : 'rounded-md border border-gray-200 p-3'}`}>
      {!compact && (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#16a34a]" />
          <h4 className="text-sm font-semibold text-gray-700">Feature Permissions</h4>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Choose which features this employee can access. All features are available regardless of role — the owner decides what each employee can do.
      </p>

      {/* Access mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleSwitchToFullAccess}
          className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${
            !useRestrictions
              ? 'border-[#16a34a] bg-[#16a34a]/5'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <ShieldCheck className={`h-4 w-4 flex-shrink-0 mt-0.5 ${!useRestrictions ? 'text-[#16a34a]' : 'text-gray-400'}`} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900">Full Access</p>
            <p className="text-[11px] text-gray-500">All features enabled</p>
          </div>
        </button>
        <button
          type="button"
          onClick={handleSwitchToRestricted}
          className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${
            useRestrictions
              ? 'border-amber-500 bg-amber-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <ShieldOff className={`h-4 w-4 flex-shrink-0 mt-0.5 ${useRestrictions ? 'text-amber-600' : 'text-gray-400'}`} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900">Restricted</p>
            <p className="text-[11px] text-gray-500">Pick specific features</p>
          </div>
        </button>
      </div>

      {useRestrictions && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {features?.length || 0} of {catalog.length} features enabled
            </p>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll} className="h-7 text-xs">
                Select All
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleDeselectAll} className="h-7 text-xs">
                Clear All
              </Button>
            </div>
          </div>

          <Separator />

          {/* Feature groups — show ALL features (not filtered by role) */}
          <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
            {Object.entries(groupedCatalog).map(([group, entries]) => (
              <div key={group} className="space-y-1.5">
                <h5 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{group}</h5>
                <div className="space-y-1.5">
                  {entries.map((entry) => {
                    const checked = features?.includes(entry.key) || false
                    return (
                      <label
                        key={entry.key}
                        htmlFor={`embed-feat-${entry.key}`}
                        className="flex items-start gap-2 rounded-md border border-gray-200 p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <Checkbox
                          id={`embed-feat-${entry.key}`}
                          checked={checked}
                          onCheckedChange={(v) => handleToggleFeature(entry.key, v === true)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-gray-900">{entry.label}</p>
                            {checked ? (
                              <Badge variant="outline" className="text-[9px] text-green-700 border-green-300 bg-green-50 h-4 px-1">On</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] text-gray-500 h-4 px-1">Off</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{entry.description}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
            {catalog.length === 0 && (
              <p className="text-xs text-gray-500 italic">
                No configurable features available.
              </p>
            )}
          </div>

          {features?.length === 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800">
              No features selected — this employee will not be able to access any features.
            </div>
          )}
        </>
      )}
    </div>
  )
}
