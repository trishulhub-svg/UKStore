'use client'

import { useState, useCallback } from 'react'
import { Key, Eye, EyeOff, Save, CheckCircle2, AlertTriangle, Loader2, Shield, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SETTING_DEFINITIONS, type StoreSetting } from '@/types'

interface AdminSettingsClientProps {
  settings: StoreSetting[]
  userId: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function AdminSettingsClient({ settings, userId }: AdminSettingsClientProps) {
  // Build editable state from settings
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {}
    for (const setting of settings) {
      vals[setting.key] = setting.value || ''
    }
    return vals
  })

  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const toggleVisibility = useCallback((key: string) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleValueChange = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
    setChangedKeys((prev) => new Set(prev).add(key))
    setSaveStatus('idle')
    setErrorMessage(null)
    // Clear field error for this key
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // Validation
  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    for (const [key, value] of Object.entries(formValues)) {
      if (!value.trim()) continue // Empty values are allowed (means "not configured")

      const def = SETTING_DEFINITIONS[key]
      if (!def) continue

      // Stripe key validation
      if (key === 'stripe_publishable_key' && !value.startsWith('pk_')) {
        errors[key] = 'Must start with pk_test_ or pk_live_'
      }
      if (key === 'stripe_secret_key' && !value.startsWith('sk_')) {
        errors[key] = 'Must start with sk_test_ or sk_live_'
      }
      if (key === 'stripe_webhook_secret' && !value.startsWith('whsec_')) {
        errors[key] = 'Must start with whsec_'
      }

      // Google OAuth validation
      if (key === 'google_oauth_client_id' && !value.includes('.apps.googleusercontent.com') && value.length > 0) {
        errors[key] = 'Should end with .apps.googleusercontent.com'
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [formValues])

  const handleSave = useCallback(async () => {
    if (!validate()) return

    setSaveStatus('saving')
    setErrorMessage(null)

    try {
      // Save all changed keys
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

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      setChangedKeys(new Set())
      setSaveStatus('saved')

      // Clear "saved" status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      setSaveStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save settings')
    }
  }, [changedKeys, formValues, userId, validate])

  // Group settings by category
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

  const hasChanges = changedKeys.size > 0
  const configuredCount = settings.filter((s) => s.value && s.value.length > 0).length
  const totalCount = settings.length

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Key className="h-6 w-6 text-[#16a34a]" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">API Keys & Settings</h1>
        </div>
        <p className="text-gray-500">
          Manage your integration keys and store configuration. Only store owners can view and edit these settings.
        </p>
      </div>

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
      {hasChanges && (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm -mx-6 px-6 py-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 text-amber-500" />
            <span className="text-gray-700">
              <strong>{changedKeys.size}</strong> unsaved change{changedKeys.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === 'saved' && (
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Saved!
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-600 font-medium">Failed to save</span>
            )}
            <Button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
            >
              {saveStatus === 'saving' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Save Changes</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-6">
          {errorMessage}
        </div>
      )}

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

                      {/* Last updated info */}
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
      {hasChanges && (
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            size="lg"
            className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
          >
            {saveStatus === 'saving' ? (
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
    </div>
  )
}
