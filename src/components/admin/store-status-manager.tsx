'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Store, Clock, Truck, Calculator, Save, Loader2, CheckCircle2, AlertTriangle,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'

// ─── Types ────────────────────────────────────────────────────

interface OpeningHoursDay {
  open: string
  close: string
  closed: boolean
}

type OpeningHours = Record<string, OpeningHoursDay>

interface StoreStatusData {
  isOpen: boolean
  openingHours: OpeningHours | null
  delivery: {
    baseDeliveryFee: number
    perKmCharge: number
    freeDeliveryThreshold: number
    deliveryRadiusKm: number
  }
}

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const DEFAULT_HOURS: OpeningHours = {
  mon: { open: '08:00', close: '20:00', closed: false },
  tue: { open: '08:00', close: '20:00', closed: false },
  wed: { open: '08:00', close: '20:00', closed: false },
  thu: { open: '08:00', close: '20:00', closed: false },
  fri: { open: '08:00', close: '21:00', closed: false },
  sat: { open: '09:00', close: '18:00', closed: false },
  sun: { open: '10:00', close: '16:00', closed: false },
}

// ─── Store Status Component ───────────────────────────────────

export function StoreStatusManager() {
  const [data, setData] = useState<StoreStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [isOpen, setIsOpen] = useState(true)
  const [openingHours, setOpeningHours] = useState<OpeningHours>(DEFAULT_HOURS)
  const [baseDeliveryFee, setBaseDeliveryFee] = useState('3.50')
  const [perKmCharge, setPerKmCharge] = useState('0.50')
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState('20.00')
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('5.00')

  // Fee calculator state
  const [testPostcode, setTestPostcode] = useState('')
  const [testCartValue, setTestCartValue] = useState('')
  const [testDistance, setTestDistance] = useState('2')
  const [calculatedFee, setCalculatedFee] = useState<number | null>(null)
  const [calculatedFree, setCalculatedFree] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/store/status')
      if (!res.ok) throw new Error()
      const d = await res.json()
      setData(d)
      setIsOpen(d.isOpen)
      if (d.openingHours) {
        setOpeningHours({ ...DEFAULT_HOURS, ...d.openingHours })
      }
      setBaseDeliveryFee(String(d.delivery.baseDeliveryFee))
      setPerKmCharge(String(d.delivery.perKmCharge))
      setFreeDeliveryThreshold(String(d.delivery.freeDeliveryThreshold))
      setDeliveryRadiusKm(String(d.delivery.deliveryRadiusKm))
    } catch {
      toast.error('Failed to load store status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleToggleOpen = async (open: boolean) => {
    setIsOpen(open)
    try {
      const res = await fetch('/api/admin/store/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: open }),
      })
      if (!res.ok) throw new Error()
      toast.success(open ? 'Store is now OPEN' : 'Store is now CLOSED')
    } catch {
      setIsOpen(!open) // revert
      toast.error('Failed to update store status')
    }
  }

  const handleSaveHours = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/store/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingHours }),
      })
      if (!res.ok) throw new Error()
      toast.success('Opening hours saved')
    } catch {
      toast.error('Failed to save opening hours')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDelivery = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/store/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery: {
            baseDeliveryFee: parseFloat(baseDeliveryFee),
            perKmCharge: parseFloat(perKmCharge),
            freeDeliveryThreshold: parseFloat(freeDeliveryThreshold),
            deliveryRadiusKm: parseFloat(deliveryRadiusKm),
          },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Delivery settings saved')
      fetchData()
    } catch {
      toast.error('Failed to save delivery settings')
    } finally {
      setSaving(false)
    }
  }

  const handleCalculateFee = () => {
    const distance = parseFloat(testDistance)
    const cartValue = parseFloat(testCartValue)
    const threshold = parseFloat(freeDeliveryThreshold)
    const base = parseFloat(baseDeliveryFee)
    const perKm = parseFloat(perKmCharge)

    if (isNaN(distance) || isNaN(cartValue)) {
      toast.error('Please enter valid distance and cart value')
      return
    }

    if (cartValue >= threshold) {
      setCalculatedFee(0)
      setCalculatedFree(true)
    } else {
      const fee = base + distance * perKm
      setCalculatedFee(Math.round(fee * 100) / 100)
      setCalculatedFree(false)
    }
  }

  const updateHours = (day: string, field: keyof OpeningHoursDay, value: string | boolean) => {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── Store Status Toggle ──────────────────────────────── */}
      <Card className={`border-2 ${isOpen ? 'border-green-300' : 'border-red-300'}`}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isOpen ? 'bg-green-100' : 'bg-red-100'}`}>
                <Store className={`h-8 w-8 ${isOpen ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {isOpen ? (
                    <span className="text-green-600">ONLINE / OPEN</span>
                  ) : (
                    <span className="text-red-600">OFFLINE / CLOSED</span>
                  )}
                </h2>
                <p className="text-gray-500 text-sm">
                  {isOpen ? 'Customers can place orders' : 'Customers see a closed overlay'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${isOpen ? 'text-green-600' : 'text-red-600'}`}>
                {isOpen ? 'Open' : 'Closed'}
              </span>
              <Switch
                checked={isOpen}
                onCheckedChange={handleToggleOpen}
                className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Opening Hours Scheduler ──────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-gray-600" />
            Opening Hours
          </CardTitle>
          <CardDescription>Set your store operating hours for each day of the week</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day) => {
            const hours = openingHours[day.key] || { open: '09:00', close: '17:00', closed: false }
            return (
              <div key={day.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-3 w-32">
                  <Switch
                    checked={!hours.closed}
                    onCheckedChange={(checked) => updateHours(day.key, 'closed', !checked)}
                    className="data-[state=checked]:bg-[#16a34a] data-[state=unchecked]:bg-gray-300"
                  />
                  <span className={`text-sm font-medium ${hours.closed ? 'text-gray-400' : 'text-gray-900'}`}>
                    {day.label}
                  </span>
                </div>
                {!hours.closed ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={hours.open}
                      onChange={(e) => updateHours(day.key, 'open', e.target.value)}
                      className="h-9 w-28 text-sm"
                    />
                    <span className="text-gray-400">to</span>
                    <Input
                      type="time"
                      value={hours.close}
                      onChange={(e) => updateHours(day.key, 'close', e.target.value)}
                      className="h-9 w-28 text-sm"
                    />
                  </div>
                ) : (
                  <Badge variant="secondary" className="text-xs w-fit">Closed</Badge>
                )}
              </div>
            )
          })}
          <div className="pt-3">
            <Button
              onClick={handleSaveHours}
              disabled={saving}
              className="bg-[#16a34a] hover:bg-[#15803d] text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Opening Hours
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Delivery Fee Engine ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-gray-600" />
            Delivery Fee Engine
          </CardTitle>
          <CardDescription>Configure delivery pricing: fee = base + (distance x per km). Free if cart total &ge; threshold.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Base Delivery Fee</Label>
              <Input
                type="number"
                step="0.10"
                min="0"
                value={baseDeliveryFee}
                onChange={(e) => setBaseDeliveryFee(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-gray-500">Starting fee for any delivery</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Per Km Charge</Label>
              <Input
                type="number"
                step="0.10"
                min="0"
                value={perKmCharge}
                onChange={(e) => setPerKmCharge(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-gray-500">Added per km of distance</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Free Delivery Threshold</Label>
              <Input
                type="number"
                step="1.00"
                min="0"
                value={freeDeliveryThreshold}
                onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-gray-500">Cart total for free delivery</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Delivery Radius (km)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={deliveryRadiusKm}
                onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-gray-500">Max delivery distance</p>
            </div>
          </div>
          <Button
            onClick={handleSaveDelivery}
            disabled={saving}
            className="bg-[#16a34a] hover:bg-[#15803d] text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Delivery Settings
          </Button>
        </CardContent>
      </Card>

      {/* ─── Test Fee Calculator ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5 text-gray-600" />
            Test Fee Calculator
          </CardTitle>
          <CardDescription>Enter a distance and cart value to see the calculated delivery fee</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Distance (km)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 2"
                value={testDistance}
                onChange={(e) => setTestDistance(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cart Value</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 25.00"
                value={testCartValue}
                onChange={(e) => setTestCartValue(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCalculateFee}
                className="w-full h-9 bg-[#16a34a] hover:bg-[#15803d] text-white"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calculate
              </Button>
            </div>
          </div>
          {calculatedFee !== null && (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Calculated Delivery Fee</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {calculatedFree ? 'FREE' : formatPrice(calculatedFee)}
                  </p>
                </div>
                <div>
                  {calculatedFree ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-sm px-3 py-1">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Free Delivery
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {formatPrice(parseFloat(baseDeliveryFee))} + {testDistance}km x {formatPrice(parseFloat(perKmCharge))}
                    </Badge>
                  )}
                </div>
              </div>
              {!calculatedFree && parseFloat(testCartValue) > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Free delivery at {formatPrice(parseFloat(freeDeliveryThreshold))} cart value (you&apos;re {formatPrice(parseFloat(freeDeliveryThreshold) - parseFloat(testCartValue))} away)
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
