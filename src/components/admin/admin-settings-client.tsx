'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Key, Eye, EyeOff, Save, CheckCircle2, AlertTriangle, Loader2, Shield, RefreshCw,
  Store as StoreIcon, Truck, FileText, ExternalLink, MapPin, Info, PoundSterling,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { ErrorAlert } from '@/components/ui/error-alert'
import type { TechnicalError } from '@/components/ui/error-alert'
import { SETTING_DEFINITIONS, type StoreSetting, type Store as StoreType, type DeliveryZone } from '@/types'
import { formatPrice } from '@/lib/vat'

// ─── Types ────────────────────────────────────────────────────

interface VatStats {
  standardCount: number
  reducedCount: number
  zeroCount: number
  hfssCount: number
}

interface AdminSettingsClientProps {
  settings: StoreSetting[]
  store: StoreType | null
  deliveryZones: DeliveryZone[]
  vatStats: VatStats
  userId: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── Component ────────────────────────────────────────────────

export function AdminSettingsClient({
  settings,
  store,
  deliveryZones,
  vatStats,
  userId,
}: AdminSettingsClientProps) {
  // ─── API Keys State (existing) ──────────────────────────────
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {}
    for (const setting of settings) {
      vals[setting.key] = setting.value || ''
    }
    return vals
  })

  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set())
  const [apiSaveStatus, setApiSaveStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | TechnicalError | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // ─── Store Information State ────────────────────────────────
  const [storeForm, setStoreForm] = useState<Record<string, any>>(() => ({
    name: store?.name || '',
    address: store?.address || '',
    phone: store?.phone || '',
    email: store?.email || '',
    latitude: store?.latitude ?? 0,
    longitude: store?.longitude ?? 0,
    base_delivery_fee: store?.base_delivery_fee ?? 0,
    per_km_charge: store?.per_km_charge ?? 0,
    free_delivery_threshold: store?.free_delivery_threshold ?? 0,
    delivery_radius_km: store?.delivery_radius_km ?? 0,
    is_active: store?.is_active ?? true,
  }))

  const [storeChanged, setStoreChanged] = useState(false)
  const [storeSaveStatus, setStoreSaveStatus] = useState<SaveStatus>('idle')
  const [storeError, setStoreError] = useState<string | null>(null)

  // ─── API Keys Handlers (existing) ──────────────────────────
  const toggleVisibility = useCallback((key: string) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleValueChange = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
    setChangedKeys((prev) => new Set(prev).add(key))
    setApiSaveStatus('idle')
    setErrorMessage(null)
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const validateApiKeys = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    for (const [key, value] of Object.entries(formValues)) {
      if (!value.trim()) continue

      if (key === 'stripe_publishable_key' && !value.startsWith('pk_')) {
        errors[key] = 'Must start with pk_test_ or pk_live_'
      }
      if (key === 'stripe_secret_key' && !value.startsWith('sk_')) {
        errors[key] = 'Must start with sk_test_ or sk_live_'
      }
      if (key === 'stripe_webhook_secret' && !value.startsWith('whsec_')) {
        errors[key] = 'Must start with whsec_'
      }
      if (key === 'google_oauth_client_id' && !value.includes('.apps.googleusercontent.com') && value.length > 0) {
        errors[key] = 'Should end with .apps.googleusercontent.com'
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [formValues])

  const handleApiKeysSave = useCallback(async () => {
    if (!validateApiKeys()) return

    setApiSaveStatus('saving')
    setErrorMessage(null)

    try {
      const updates = Array.from(changedKeys).map((key) => ({
        key,
        value: formValues[key] || '',
        last_updated_by: userId,
      }))

      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates }),
      })

      const data = await response.json()

      if (!response.ok) {
        const timestamp = new Date().toISOString()
        const techErr = data.technicalError
        if (techErr) {
          setErrorMessage({ ...techErr, timestamp: techErr.timestamp || timestamp })
        } else {
          setErrorMessage({
            message: data.error || 'Failed to save settings.',
            code: `HTTP_${response.status}`,
            status: response.status,
            details: JSON.stringify(data, null, 2),
            timestamp,
            endpoint: '/api/admin/settings',
          })
        }
        setApiSaveStatus('error')
        return
      }

      setChangedKeys(new Set())
      setApiSaveStatus('saved')
      setTimeout(() => setApiSaveStatus('idle'), 3000)
    } catch (err) {
      setApiSaveStatus('error')
      const errMsg = err instanceof Error ? err.message : String(err)
      setErrorMessage({
        message: 'Failed to save settings due to a network or client error.',
        code: 'CLIENT_ERROR',
        details: `Error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp: new Date().toISOString(),
        endpoint: '/api/admin/settings',
      })
    }
  }, [changedKeys, formValues, userId, validateApiKeys])

  // ─── Store Information Handlers ────────────────────────────
  const handleStoreFieldChange = useCallback((field: string, value: any) => {
    setStoreForm((prev) => ({ ...prev, [field]: value }))
    setStoreChanged(true)
    setStoreSaveStatus('idle')
    setStoreError(null)
  }, [])

  const handleStoreSave = useCallback(async () => {
    setStoreSaveStatus('saving')
    setStoreError(null)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store: {
            name: storeForm.name,
            address: storeForm.address,
            phone: storeForm.phone,
            email: storeForm.email,
            base_delivery_fee: Number(storeForm.base_delivery_fee),
            per_km_charge: Number(storeForm.per_km_charge),
            free_delivery_threshold: Number(storeForm.free_delivery_threshold),
            delivery_radius_km: Number(storeForm.delivery_radius_km),
            is_active: storeForm.is_active,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStoreError(data.error || 'Failed to save store information.')
        setStoreSaveStatus('error')
        return
      }

      setStoreChanged(false)
      setStoreSaveStatus('saved')
      setTimeout(() => setStoreSaveStatus('idle'), 3000)
    } catch (err) {
      setStoreSaveStatus('error')
      setStoreError(err instanceof Error ? err.message : 'Failed to save store information.')
    }
  }, [storeForm])

  // ─── Group settings by category (for API Keys tab) ─────────
  const categories: Record<string, StoreSetting[]> = {}
  for (const setting of settings) {
    if (!categories[setting.category]) {
      categories[setting.category] = []
    }
    categories[setting.category].push(setting)
  }

  const categoryLabels: Record<string, { label: string; icon: string; description: string }> = {
    integrations: {
      label: 'Payment & Integrations',
      icon: '🔌',
      description: 'API keys for third-party services. These are stored securely and only accessible by store owners.',
    },
    notifications: {
      label: 'Notifications',
      icon: '📧',
      description: 'Email and notification service configuration.',
    },
    delivery: {
      label: 'Delivery',
      icon: '🚚',
      description: 'Delivery and logistics provider configuration.',
    },
    general: {
      label: 'General',
      icon: '⚙️',
      description: 'General store configuration.',
    },
  }

  const apiHasChanges = changedKeys.size > 0
  const configuredCount = settings.filter((s) => s.value && s.value.length > 0).length
  const totalCount = settings.length

  // ─── Delivery Zones helpers ────────────────────────────────
  const parsePostcodes = (json: string): string[] => {
    try {
      return JSON.parse(json)
    } catch {
      return []
    }
  }

  const totalPostcodes = deliveryZones.reduce((acc, z) => {
    return acc + parsePostcodes(z.postcodes).length
  }, 0)

  const activeZones = deliveryZones.filter((z) => z.is_active).length

  // ─── Render ────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-6 w-6 text-[#16a34a]" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-gray-500">
          Manage your store information, integrations, delivery settings, and compliance.
        </p>
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="store" className="w-full">
        <TabsList className="w-full sm:w-auto mb-6 flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="store" className="gap-1.5 text-xs sm:text-sm">
            <StoreIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Store Information</span>
            <span className="sm:hidden">Store</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-1.5 text-xs sm:text-sm">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
            <span className="sm:hidden">API</span>
            {apiHasChanges && (
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="delivery" className="gap-1.5 text-xs sm:text-sm">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Delivery & Zones</span>
            <span className="sm:hidden">Delivery</span>
          </TabsTrigger>
          <TabsTrigger value="vat" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">VAT & Compliance</span>
            <span className="sm:hidden">VAT</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Store Information ──────────────────────── */}
        <TabsContent value="store">
          {/* Save Bar (sticky) */}
          {storeChanged && (
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm -mx-6 px-6 py-3 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4 text-amber-500" />
                <span className="text-gray-700">Unsaved changes</span>
              </div>
              <div className="flex items-center gap-3">
                {storeSaveStatus === 'saved' && (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Saved!
                  </span>
                )}
                {storeSaveStatus === 'error' && (
                  <span className="text-sm text-red-600 font-medium">Failed to save</span>
                )}
                <Button
                  onClick={handleStoreSave}
                  disabled={storeSaveStatus === 'saving'}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                >
                  {storeSaveStatus === 'saving' ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save Changes</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {storeError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-700">{storeError}</p>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <StoreIcon className="h-5 w-5 text-[#16a34a]" />
                Basic Information
              </CardTitle>
              <CardDescription>Your store&apos;s public-facing details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="store-name" className="text-sm font-medium text-gray-700">
                    Store Name
                  </Label>
                  <Input
                    id="store-name"
                    type="text"
                    value={storeForm.name}
                    onChange={(e) => handleStoreFieldChange('name', e.target.value)}
                    placeholder="Fresh Mart UK"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-address" className="text-sm font-medium text-gray-700">
                    Store Address
                  </Label>
                  <Input
                    id="store-address"
                    type="text"
                    value={storeForm.address}
                    onChange={(e) => handleStoreFieldChange('address', e.target.value)}
                    placeholder="123 High Street, London"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="store-phone" className="text-sm font-medium text-gray-700">
                    Phone
                  </Label>
                  <Input
                    id="store-phone"
                    type="text"
                    value={storeForm.phone || ''}
                    onChange={(e) => handleStoreFieldChange('phone', e.target.value)}
                    placeholder="+44 20 1234 5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-email" className="text-sm font-medium text-gray-700">
                    Email
                  </Label>
                  <Input
                    id="store-email"
                    type="email"
                    value={storeForm.email || ''}
                    onChange={(e) => handleStoreFieldChange('email', e.target.value)}
                    placeholder="hello@freshmart.co.uk"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="store-latitude" className="text-sm font-medium text-gray-500">
                    Latitude
                  </Label>
                  <Input
                    id="store-latitude"
                    type="number"
                    step="0.000001"
                    value={storeForm.latitude}
                    readOnly
                    className="bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400">Read-only — set during store setup</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-longitude" className="text-sm font-medium text-gray-500">
                    Longitude
                  </Label>
                  <Input
                    id="store-longitude"
                    type="number"
                    step="0.000001"
                    value={storeForm.longitude}
                    readOnly
                    className="bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400">Read-only — set during store setup</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-gray-700">Store Active</Label>
                  <p className="text-xs text-gray-500">When active, customers can place orders.</p>
                </div>
                <Switch
                  checked={storeForm.is_active}
                  onCheckedChange={(v) => handleStoreFieldChange('is_active', v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Delivery Pricing */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PoundSterling className="h-5 w-5 text-[#16a34a]" />
                Delivery Pricing
              </CardTitle>
              <CardDescription>
                Configure how delivery fees are calculated. These are the default rates — delivery zones can override them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="base-delivery-fee" className="text-sm font-medium text-gray-700">
                    Base Delivery Fee (GBP)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                    <Input
                      id="base-delivery-fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={storeForm.base_delivery_fee}
                      onChange={(e) => handleStoreFieldChange('base_delivery_fee', e.target.value)}
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Fixed fee applied to every delivery</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="per-km-charge" className="text-sm font-medium text-gray-700">
                    Per KM Charge (GBP)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                    <Input
                      id="per-km-charge"
                      type="number"
                      step="0.01"
                      min="0"
                      value={storeForm.per_km_charge}
                      onChange={(e) => handleStoreFieldChange('per_km_charge', e.target.value)}
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Additional charge per kilometre from store</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="free-delivery-threshold" className="text-sm font-medium text-gray-700">
                    Free Delivery Threshold (GBP)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                    <Input
                      id="free-delivery-threshold"
                      type="number"
                      step="0.01"
                      min="0"
                      value={storeForm.free_delivery_threshold}
                      onChange={(e) => handleStoreFieldChange('free_delivery_threshold', e.target.value)}
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Orders above this amount get free delivery</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delivery-radius-km" className="text-sm font-medium text-gray-700">
                    Delivery Radius (KM)
                  </Label>
                  <Input
                    id="delivery-radius-km"
                    type="number"
                    step="0.1"
                    min="0"
                    value={storeForm.delivery_radius_km}
                    onChange={(e) => handleStoreFieldChange('delivery_radius_km', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Maximum delivery distance from store</p>
                </div>
              </div>

              {/* Current pricing preview */}
              <Separator />
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">CURRENT PRICING PREVIEW</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Base Fee</p>
                    <p className="text-lg font-semibold text-gray-900">{formatPrice(Number(storeForm.base_delivery_fee) || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Per KM</p>
                    <p className="text-lg font-semibold text-gray-900">{formatPrice(Number(storeForm.per_km_charge) || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Free Above</p>
                    <p className="text-lg font-semibold text-gray-900">{formatPrice(Number(storeForm.free_delivery_threshold) || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Max Radius</p>
                    <p className="text-lg font-semibold text-gray-900">{Number(storeForm.delivery_radius_km) || 0} km</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Save Button */}
          {storeChanged && (
            <div className="flex justify-end pt-2 pb-4">
              <Button
                onClick={handleStoreSave}
                disabled={storeSaveStatus === 'saving'}
                size="lg"
                className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
              >
                {storeSaveStatus === 'saving' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Save Store Information</>
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ─── Tab 2: API Keys & Integrations ────────────────── */}
        <TabsContent value="api-keys">
          {/* Security Notice */}
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800">Secure Storage</p>
                  <p className="text-sm text-blue-700 mt-0.5">
                    API keys are protected by Row Level Security (RLS). Only users with the <strong>owner</strong> role can view and modify them.
                    Secret values are masked by default. Database values take priority over environment variables when both are set.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuration Status */}
          <div className="flex items-center gap-3 mb-6">
            <Badge
              variant="outline"
              className={`text-sm px-3 py-1 ${
                configuredCount === totalCount
                  ? 'border-green-300 text-green-700 bg-green-50'
                  : 'border-amber-300 text-amber-700 bg-amber-50'
              }`}
            >
              {configuredCount === totalCount ? (
                <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> All {totalCount} keys configured</>
              ) : (
                <><AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> {configuredCount}/{totalCount} keys configured</>
              )}
            </Badge>
          </div>

          {/* Save Bar (sticky) */}
          {apiHasChanges && (
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm -mx-6 px-6 py-3 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4 text-amber-500" />
                <span className="text-gray-700">
                  <strong>{changedKeys.size}</strong> unsaved change{changedKeys.size !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {apiSaveStatus === 'saved' && (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Saved!
                  </span>
                )}
                {apiSaveStatus === 'error' && (
                  <span className="text-sm text-red-600 font-medium">Failed to save</span>
                )}
                <Button
                  onClick={handleApiKeysSave}
                  disabled={apiSaveStatus === 'saving'}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                >
                  {apiSaveStatus === 'saving' ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save Changes</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Error Message */}
          <ErrorAlert error={errorMessage} className="mb-6" />

          {/* Settings by Category */}
          {Object.entries(categories).map(([category, categorySettings]) => {
            const meta = categoryLabels[category] || { label: category, icon: '⚙️', description: '' }

            return (
              <Card key={category} className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-xl">{meta.icon}</span>
                    {meta.label}
                  </CardTitle>
                  <CardDescription>{meta.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {categorySettings.map((setting, index) => {
                    const def = SETTING_DEFINITIONS[setting.key]
                    const label = def?.label || setting.key
                    const placeholder = def?.placeholder || 'Enter value...'
                    const description = setting.description || def?.description
                    const isSecret = setting.is_secret
                    const isVisible = visibleKeys[setting.key]
                    const isConfigured = !!(formValues[setting.key] && formValues[setting.key].length > 0)
                    const hasError = !!fieldErrors[setting.key]
                    const isChanged = changedKeys.has(setting.key)

                    return (
                      <div key={setting.key}>
                        {index > 0 && <Separator className="mb-6" />}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={setting.key} className="text-sm font-medium text-gray-700">
                              {label}
                              {isSecret && (
                                <Badge variant="secondary" className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0">
                                  SECRET
                                </Badge>
                              )}
                            </Label>
                            <div className="flex items-center gap-2">
                              {isConfigured ? (
                                <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50 px-1.5 py-0">
                                  CONFIGURED
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-500 px-1.5 py-0">
                                  NOT SET
                                </Badge>
                              )}
                              {isChanged && (
                                <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50 px-1.5 py-0">
                                  MODIFIED
                                </Badge>
                              )}
                            </div>
                          </div>

                          {description && (
                            <p className="text-xs text-gray-500">{description}</p>
                          )}

                          <div className="relative">
                            <Input
                              id={setting.key}
                              type={isSecret && !isVisible ? 'password' : 'text'}
                              placeholder={placeholder}
                              value={formValues[setting.key] || ''}
                              onChange={(e) => handleValueChange(setting.key, e.target.value)}
                              className={`${hasError ? 'border-red-300 focus-visible:ring-red-500' : ''} ${isChanged ? 'border-blue-300' : ''}`}
                              autoComplete="off"
                              data-1p-ignore
                            />
                            {isSecret && (
                              <button
                                type="button"
                                onClick={() => toggleVisibility(setting.key)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            )}
                          </div>

                          {hasError && (
                            <p className="text-xs text-red-600">{fieldErrors[setting.key]}</p>
                          )}

                          <p className="text-xs text-gray-400">
                            {isConfigured
                              ? `Last updated: ${new Date(setting.updated_at).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : 'No value set — will fall back to environment variable if available'
                            }
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}

          {/* Bottom Save Button */}
          {apiHasChanges && (
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleApiKeysSave}
                disabled={apiSaveStatus === 'saving'}
                size="lg"
                className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
              >
                {apiSaveStatus === 'saving' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Save All Changes</>
                )}
              </Button>
            </div>
          )}

          {/* Priority Notice */}
          <Card className="mt-8 bg-gray-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-700 text-sm">How API Key Priority Works</p>
                  <ul className="text-xs text-gray-500 mt-2 space-y-1 list-disc list-inside">
                    <li><strong>Database values</strong> (set here) always take priority over environment variables</li>
                    <li><strong>Environment variables</strong> (.env.local) serve as fallback when no DB value is set</li>
                    <li>Clearing a value here will cause the system to fall back to the environment variable</li>
                    <li>Changes are protected by Row Level Security — only the <strong>owner</strong> role can modify these settings</li>
                    <li>All secret keys are masked by default and must be explicitly revealed</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Delivery & Zones ───────────────────────── */}
        <TabsContent value="delivery">
          {/* Link to full management */}
          <Card className="mb-6 border-[#16a34a]/20 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Truck className="h-5 w-5 text-[#16a34a] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">Full Delivery Zone Management</p>
                    <p className="text-sm text-green-700 mt-0.5">
                      Create, edit, and delete delivery zones with postcode assignments on the dedicated management page.
                    </p>
                  </div>
                </div>
                <Link href="/admin/delivery-zones">
                  <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-100 gap-1.5 shrink-0">
                    <ExternalLink className="h-4 w-4" />
                    <span className="hidden sm:inline">Manage Zones</span>
                    <span className="sm:hidden">Open</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Zones Table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-[#16a34a]" />
                Delivery Zones
              </CardTitle>
              <CardDescription>
                {deliveryZones.length} zone{deliveryZones.length !== 1 ? 's' : ''} configured ({activeZones} active)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deliveryZones.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-3">No delivery zones configured yet.</p>
                  <Link href="/admin/delivery-zones">
                    <Button className="bg-[#16a34a] hover:bg-[#15803d] text-white">
                      Create Your First Zone
                    </Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Postcodes</TableHead>
                      <TableHead>Delivery Fee</TableHead>
                      <TableHead>Min. Order</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryZones.map((zone) => {
                      const postcodes = parsePostcodes(zone.postcodes)
                      return (
                        <TableRow key={zone.id}>
                          <TableCell className="font-medium text-gray-900">
                            {zone.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {postcodes.slice(0, 4).map((pc) => (
                                <Badge key={pc} variant="secondary" className="text-xs">{pc}</Badge>
                              ))}
                              {postcodes.length > 4 && (
                                <Badge variant="outline" className="text-xs">+{postcodes.length - 4}</Badge>
                              )}
                              {postcodes.length === 0 && (
                                <span className="text-xs text-gray-400">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatPrice(zone.delivery_fee)}</TableCell>
                          <TableCell>{formatPrice(zone.minimum_order)}</TableCell>
                          <TableCell>
                            {zone.is_active ? (
                              <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs border-gray-300 text-gray-500">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Delivery Coverage Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5 text-[#16a34a]" />
                Delivery Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{deliveryZones.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Zones</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{activeZones}</p>
                  <p className="text-xs text-gray-500 mt-1">Active Zones</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{totalPostcodes}</p>
                  <p className="text-xs text-gray-500 mt-1">Postcodes Covered</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {storeForm.delivery_radius_km || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">KM Radius</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 4: VAT & Compliance ───────────────────────── */}
        <TabsContent value="vat">
          {/* UK VAT Rates */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">UK VAT Rates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Standard Rate */}
              <Card className="border-red-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-red-600 uppercase tracking-wider">Standard Rate</span>
                    <span className="text-2xl font-bold text-red-600">20%</span>
                  </div>
                  <p className="text-xs text-gray-500">Most goods and services</p>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Products</span>
                    <span className="text-sm font-semibold text-gray-900">{vatStats.standardCount}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Reduced Rate */}
              <Card className="border-amber-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Reduced Rate</span>
                    <span className="text-2xl font-bold text-amber-600">5%</span>
                  </div>
                  <p className="text-xs text-gray-500">Children&apos;s car seats, energy-saving materials</p>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Products</span>
                    <span className="text-sm font-semibold text-gray-900">{vatStats.reducedCount}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Zero Rate */}
              <Card className="border-green-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-600 uppercase tracking-wider">Zero Rate</span>
                    <span className="text-2xl font-bold text-green-600">0%</span>
                  </div>
                  <p className="text-xs text-gray-500">Most food, books, children&apos;s clothes</p>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Products</span>
                    <span className="text-sm font-semibold text-gray-900">{vatStats.zeroCount}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Product Distribution by VAT Rate */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-[#16a34a]" />
                Product Distribution by VAT Rate
              </CardTitle>
              <CardDescription>Number of products assigned to each VAT rate band.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Standard 20% */}
                <div className="flex items-center gap-4">
                  <div className="w-20 shrink-0">
                    <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 text-xs">
                      20% VAT
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            (vatStats.standardCount /
                              Math.max(vatStats.standardCount + vatStats.reducedCount + vatStats.zeroCount, 1)) *
                              100,
                            2
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                    {vatStats.standardCount} item{vatStats.standardCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Reduced 5% */}
                <div className="flex items-center gap-4">
                  <div className="w-20 shrink-0">
                    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-xs">
                      5% VAT
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            (vatStats.reducedCount /
                              Math.max(vatStats.standardCount + vatStats.reducedCount + vatStats.zeroCount, 1)) *
                              100,
                            2
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                    {vatStats.reducedCount} item{vatStats.reducedCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Zero 0% */}
                <div className="flex items-center gap-4">
                  <div className="w-20 shrink-0">
                    <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 text-xs">
                      0% VAT
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            (vatStats.zeroCount /
                              Math.max(vatStats.standardCount + vatStats.reducedCount + vatStats.zeroCount, 1)) *
                              100,
                            2
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                    {vatStats.zeroCount} item{vatStats.zeroCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Total Products</span>
                <span className="font-semibold text-gray-900">
                  {vatStats.standardCount + vatStats.reducedCount + vatStats.zeroCount}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* HFSS Compliance */}
          <Card className="mb-6 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                HFSS Compliance
              </CardTitle>
              <CardDescription>
                High Fat, Sugar, and Salt regulations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-orange-800">
                  Products flagged as HFSS (High Fat, Sugar, and Salt) are automatically excluded from promotional
                  placements per UK regulations effective January 2026.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">HFSS-Flagged Products</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    These products are restricted from volume promotions and prominent placement
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-orange-600">{vatStats.hfssCount}</p>
                  <p className="text-xs text-gray-500">product{vatStats.hfssCount !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>What this means:</strong></p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>HFSS products cannot be placed in &quot;buy one get one free&quot; or similar volume promotions</li>
                  <li>They are excluded from featured/promoted positions on the storefront</li>
                  <li>They remain available for purchase but without promotional pricing incentives</li>
                  <li>The <code className="bg-gray-100 px-1 rounded">is_hfss</code> flag on each product controls this behaviour</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* VAT Reference */}
          <Card className="bg-gray-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-700 text-sm">UK VAT Reference</p>
                  <ul className="text-xs text-gray-500 mt-2 space-y-1 list-disc list-inside">
                    <li>VAT rates are set per-product in the product management section</li>
                    <li>The <strong>Standard Rate (20%)</strong> applies to most non-food items, alcohol, and soft drinks</li>
                    <li>The <strong>Reduced Rate (5%)</strong> applies to some goods like children&apos;s car seats and energy-saving materials</li>
                    <li>The <strong>Zero Rate (0%)</strong> applies to most groceries (unprepared food), books, and children&apos;s clothing</li>
                    <li>VAT is calculated automatically at checkout based on each product&apos;s assigned rate</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
