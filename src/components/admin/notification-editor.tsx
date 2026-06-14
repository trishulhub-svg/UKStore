'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Save, Loader2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────

interface NotificationTemplate {
  orderConfirmation: string
  orderPicking: string
  outForDelivery: string
  orderDelivered: string
  storeClosed: string
}

const DEFAULT_TEMPLATES: NotificationTemplate = {
  orderConfirmation: 'Your order #{orderId} has been placed!',
  orderPicking: "We're picking your order now...",
  outForDelivery: 'Your order is on the way!',
  orderDelivered: 'Your order has been delivered!',
  storeClosed: "We're currently closed. See you soon!",
}

const TEMPLATE_CONFIG: Array<{
  key: keyof NotificationTemplate
  label: string
  description: string
  variables: string[]
  previewContext: string
}> = [
  {
    key: 'orderConfirmation',
    label: 'Order Confirmation',
    description: 'Sent when a customer places an order',
    variables: ['{orderId}', '{customerName}', '{total}'],
    previewContext: 'order',
  },
  {
    key: 'orderPicking',
    label: 'Order Picking',
    description: 'Sent when staff start picking the order',
    variables: ['{orderId}', '{customerName}'],
    previewContext: 'order',
  },
  {
    key: 'outForDelivery',
    label: 'Out for Delivery',
    description: 'Sent when the driver is en route',
    variables: ['{orderId}', '{driverName}', '{eta}'],
    previewContext: 'delivery',
  },
  {
    key: 'orderDelivered',
    label: 'Order Delivered',
    description: 'Sent when the order is confirmed delivered',
    variables: ['{orderId}', '{customerName}'],
    previewContext: 'delivery',
  },
  {
    key: 'storeClosed',
    label: 'Store Closed',
    description: 'Shown when customers try to order while closed',
    variables: ['{openingTime}'],
    previewContext: 'closed',
  },
]

// ─── Preview Component ────────────────────────────────────────

function NotificationPreview({ template, context }: { template: string; context: string }) {
  let previewText = template
  if (context === 'order') {
    previewText = template
      .replace('{orderId}', 'A1B2C3D4')
      .replace('{customerName}', 'John Smith')
      .replace('{total}', '£25.99')
  } else if (context === 'delivery') {
    previewText = template
      .replace('{orderId}', 'A1B2C3D4')
      .replace('{driverName}', 'Mike')
      .replace('{eta}', '15 min')
  } else if (context === 'closed') {
    previewText = template.replace('{openingTime}', '8:00 AM')
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-[#16a34a] flex items-center justify-center">
          <Bell className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900">Fresh Mart</p>
          <p className="text-[10px] text-gray-400">just now</p>
        </div>
      </div>
      <p className="text-sm text-gray-700">{previewText}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export function NotificationEditor() {
  const [templates, setTemplates] = useState<NotificationTemplate>(DEFAULT_TEMPLATES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewKey, setPreviewKey] = useState<keyof NotificationTemplate>('orderConfirmation')

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/store/status')
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.notificationTemplate) {
        setTemplates({ ...DEFAULT_TEMPLATES, ...data.notificationTemplate })
      }
    } catch {
      toast.error('Failed to load notification templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/store/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationTemplate: templates }),
      })
      if (!res.ok) throw new Error()
      toast.success('Notification templates saved')
    } catch {
      toast.error('Failed to save notification templates')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-gray-600" />
          Notification Templates
        </CardTitle>
        <CardDescription>
          Customise the text for customer notifications. Use variables like {'{orderId}'} to personalise messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {TEMPLATE_CONFIG.map((config, index) => (
          <div key={config.key}>
            {index > 0 && <Separator className="mb-6" />}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <Label className="text-sm font-medium text-gray-700">{config.label}</Label>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-[#16a34a]"
                  onClick={() => setPreviewKey(config.key)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>

              <Textarea
                value={templates[config.key]}
                onChange={(e) =>
                  setTemplates((prev) => ({ ...prev, [config.key]: e.target.value }))
                }
                className="min-h-[60px] text-sm"
                placeholder={DEFAULT_TEMPLATES[config.key]}
              />

              <div className="flex flex-wrap gap-1.5">
                {config.variables.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono hover:bg-gray-200 transition-colors"
                    onClick={() => {
                      const textarea = document.querySelector(`[data-template="${config.key}"]`) as HTMLTextAreaElement
                      if (textarea) {
                        const start = textarea.selectionStart
                        const current = templates[config.key]
                        const newVal = current.slice(0, start) + v + current.slice(start)
                        setTemplates((prev) => ({ ...prev, [config.key]: newVal }))
                      }
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <Separator />

        {/* Preview Panel */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview — {TEMPLATE_CONFIG.find((c) => c.key === previewKey)?.label}
          </p>
          <div className="flex justify-start">
            <NotificationPreview
              template={templates[previewKey]}
              context={TEMPLATE_CONFIG.find((c) => c.key === previewKey)?.previewContext || 'order'}
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#16a34a] hover:bg-[#15803d] text-white"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save Templates</>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
