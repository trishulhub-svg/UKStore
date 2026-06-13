'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, MapPin, Clock, ShoppingBag, CreditCard, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { ErrorAlert } from '@/components/ui/error-alert'
import type { TechnicalError } from '@/components/ui/error-alert'
import { useCartStore } from '@/store/cart'
import { formatPrice, getVatRateLabel, calculateVatFromGross } from '@/lib/vat'
import type { Store, Address } from '@/types'

interface CheckoutClientProps {
  store: Store
  user: { id: string; email: string; name: string }
  addresses: Address[]
}

const deliverySlots = [
  { id: 'today-4-6', label: 'Today 4-6pm', description: 'Express delivery today' },
  { id: 'today-6-8', label: 'Today 6-8pm', description: 'Evening delivery today' },
  { id: 'tomorrow-10-12', label: 'Tomorrow 10am-12pm', description: 'Morning delivery tomorrow' },
  { id: 'tomorrow-12-2', label: 'Tomorrow 12-2pm', description: 'Lunchtime delivery tomorrow' },
]

const categoryIcons: Record<string, string> = {
  'fruits-vegetables': '🥬',
  'dairy-eggs': '🥛',
  'meat-fish': '🥩',
  'bakery': '🍞',
  'pantry': '🫙',
  'drinks': '🧃',
  'frozen': '🧊',
  'snacks-sweets': '🍫',
}

type Step = 'address' | 'slot' | 'summary' | 'payment'

const steps: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'slot', label: 'Delivery Slot', icon: Clock },
  { id: 'summary', label: 'Summary', icon: ShoppingBag },
  { id: 'payment', label: 'Payment', icon: CreditCard },
]

export function CheckoutClient({ store, user, addresses }: CheckoutClientProps) {
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const clearCart = useCartStore((state) => state.clearCart)

  const [currentStep, setCurrentStep] = useState<Step>('address')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | TechnicalError | null>(null)

  // Address form state
  const defaultAddress = addresses.find((a) => a.is_default)
  const [addressLine1, setAddressLine1] = useState(defaultAddress?.address_line_1 || '')
  const [addressLine2, setAddressLine2] = useState(defaultAddress?.address_line_2 || '')
  const [city, setCity] = useState(defaultAddress?.city || '')
  const [postcode, setPostcode] = useState(defaultAddress?.postcode || '')
  const [saveAddress, setSaveAddress] = useState(false)

  // Delivery slot state
  const [selectedSlot, setSelectedSlot] = useState(deliverySlots[0].id)

  // Calculate totals
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0)

  const vatGroups: Record<number, { gross: number; vat: number; label: string }> = {}
  items.forEach((item) => {
    const rate = item.product.vat_rate
    const itemGross = item.product.price * item.quantity
    const itemVat = calculateVatFromGross(itemGross, rate)
    if (!vatGroups[rate]) {
      vatGroups[rate] = { gross: 0, vat: 0, label: getVatRateLabel(rate) }
    }
    vatGroups[rate].gross += itemGross
    vatGroups[rate].vat += itemVat
  })

  const totalVat = Object.values(vatGroups).reduce((sum, group) => sum + group.vat, 0)
  const distanceKm = 2
  const isFreeDelivery = subtotal >= store.free_delivery_threshold
  const deliveryFee = isFreeDelivery ? 0 : store.base_delivery_fee + store.per_km_charge * distanceKm
  const total = subtotal + deliveryFee

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  const validateAddress = (): boolean => {
    if (!addressLine1.trim()) return false
    if (!city.trim()) return false
    if (!postcode.trim()) return false
    // Basic UK postcode validation
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
    if (!postcodeRegex.test(postcode.trim())) return false
    return true
  }

  const handleNext = () => {
    setError(null)
    if (currentStep === 'address') {
      if (!validateAddress()) {
        setError({
          message: 'Please fill in all address fields with a valid UK postcode.',
          code: 'INVALID_ADDRESS',
          details: `Address line 1: ${addressLine1 ? 'provided' : 'missing'}\nCity: ${city ? 'provided' : 'missing'}\nPostcode: ${postcode || 'missing'}\nUK postcode format: SW1A 1AA`,
          timestamp: new Date().toISOString(),
        })
        return
      }
      setCurrentStep('slot')
    } else if (currentStep === 'slot') {
      setCurrentStep('summary')
    } else if (currentStep === 'summary') {
      setCurrentStep('payment')
    }
  }

  const handleBack = () => {
    setError(null)
    if (currentStep === 'slot') setCurrentStep('address')
    else if (currentStep === 'summary') setCurrentStep('slot')
    else if (currentStep === 'payment') setCurrentStep('summary')
  }

  const handlePlaceOrder = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            unit_price: item.product.price,
            vat_rate: item.product.vat_rate,
            substitute_preference: item.substitute_preference,
          })),
          address: {
            address_line_1: addressLine1,
            address_line_2: addressLine2,
            city,
            postcode,
          },
          delivery_slot: selectedSlot,
          subtotal,
          vat_amount: totalVat,
          delivery_fee: deliveryFee,
          total,
          save_address: saveAddress,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const timestamp = new Date().toISOString()
        const techErr = data.technicalError
        if (techErr) {
          setError({ ...techErr, timestamp: techErr.timestamp || timestamp })
        } else {
          setError({
            message: data.error || 'Failed to place order.',
            code: `HTTP_${response.status}`,
            status: response.status,
            details: JSON.stringify(data, null, 2),
            timestamp,
            endpoint: '/api/checkout',
          })
        }
        return
      }

      clearCart()
      router.push(`/order/${data.orderId}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const isNetworkError = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')
      setError({
        message: isNetworkError
          ? 'Unable to connect to the server. Please check your internet connection.'
          : `An unexpected error occurred while placing your order: ${errMsg}`,
        code: isNetworkError ? 'NETWORK_ERROR' : 'CLIENT_ERROR',
        details: `Error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp: new Date().toISOString(),
        endpoint: '/api/checkout',
      })
    } finally {
      setLoading(false)
    }
  }

  // Redirect if cart is empty (except on payment step where order might have just been placed)
  if (items.length === 0 && currentStep !== 'payment') {
    return (
      <CustomerLayout storeName={store.name}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center max-w-md mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Cart is Empty</h1>
            <p className="text-gray-500 mb-6">Add some items to your cart before checking out.</p>
            <Link href="/catalog">
              <Button className="bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold">
                Browse Products
              </Button>
            </Link>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout storeName={store.name}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Checkout</h1>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isCompleted = currentStepIndex > index
              const isCurrent = currentStep === step.id

              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? 'bg-[#16a34a] border-[#16a34a] text-white'
                          : isCurrent
                          ? 'bg-white border-[#16a34a] text-[#16a34a]'
                          : 'bg-white border-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span
                      className={`text-xs mt-1.5 font-medium ${
                        isCurrent ? 'text-[#16a34a]' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mt-[-1.25rem] ${
                        isCompleted ? 'bg-[#16a34a]' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Error Message */}
        <ErrorAlert error={error} />

        {/* Step Content */}
        {currentStep === 'address' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#16a34a]" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Saved Addresses */}
              {addresses.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Saved Addresses</Label>
                  <RadioGroup
                    value={defaultAddress?.id || ''}
                    className="space-y-2 mb-4"
                  >
                    {addresses.map((addr) => (
                      <div key={addr.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={addr.id} id={`addr-${addr.id}`} />
                        <Label htmlFor={`addr-${addr.id}`} className="text-sm font-normal cursor-pointer">
                          {addr.address_line_1}, {addr.city}, {addr.postcode}
                          {addr.is_default && (
                            <span className="ml-2 text-xs text-[#16a34a] font-medium">(Default)</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <Separator className="my-4" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="address_line_1">Address Line 1 *</Label>
                <Input
                  id="address_line_1"
                  placeholder="e.g., 123 High Street"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_line_2">Address Line 2</Label>
                <Input
                  id="address_line_2"
                  placeholder="Flat, suite, unit etc. (optional)"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="e.g., London"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode *</Label>
                  <Input
                    id="postcode"
                    placeholder="e.g., SE13 6LG"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    required
                    className="uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="save_address"
                  checked={saveAddress}
                  onCheckedChange={(checked) => setSaveAddress(checked === true)}
                />
                <Label htmlFor="save_address" className="text-sm font-normal cursor-pointer">
                  Save this address for future orders
                </Label>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleNext}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                >
                  Continue to Delivery Slot
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'slot' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#16a34a]" />
                Choose a Delivery Slot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={selectedSlot}
                onValueChange={setSelectedSlot}
                className="space-y-3"
              >
                {deliverySlots.map((slot) => (
                  <div key={slot.id}>
                    <Label
                      htmlFor={`slot-${slot.id}`}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedSlot === slot.id
                          ? 'border-[#16a34a] bg-[#16a34a]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={slot.id} id={`slot-${slot.id}`} />
                        <div>
                          <p className="font-medium text-sm">{slot.label}</p>
                          <p className="text-xs text-gray-500">{slot.description}</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                >
                  Review Order
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'summary' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#16a34a]" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Delivery Address */}
              <div>
                <h3 className="font-medium text-sm text-gray-700 mb-2">Delivery Address</h3>
                <p className="text-sm text-gray-900">
                  {addressLine1}
                  {addressLine2 && `, ${addressLine2}`}
                  <br />
                  {city}, {postcode}
                </p>
              </div>

              {/* Delivery Slot */}
              <div>
                <h3 className="font-medium text-sm text-gray-700 mb-2">Delivery Slot</h3>
                <p className="text-sm text-gray-900">
                  {deliverySlots.find((s) => s.id === selectedSlot)?.label}
                </p>
              </div>

              <Separator />

              {/* Items */}
              <div>
                <h3 className="font-medium text-sm text-gray-700 mb-3">Items ({items.length})</h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {categoryIcons[item.product.category?.slug || ''] || '🛒'}
                        </span>
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatPrice(item.product.price)} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-medium">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                {Object.entries(vatGroups).map(([rate, group]) => (
                  <div key={rate} className="flex justify-between text-sm">
                    <span className="text-gray-500">{group.label} VAT</span>
                    <span className="text-gray-600">{formatPrice(group.vat)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery fee</span>
                  <span className="font-medium">
                    {isFreeDelivery ? (
                      <span className="text-[#16a34a]">Free</span>
                    ) : (
                      formatPrice(deliveryFee)
                    )}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                >
                  Proceed to Payment
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'payment' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#16a34a]" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 mb-3">
                  Total amount to pay
                </p>
                <p className="text-3xl font-bold text-gray-900">{formatPrice(total)}</p>
                {totalVat > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Includes {formatPrice(totalVat)} VAT
                  </p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Demo Mode:</strong> Payment will be simulated. No real charges will be made.
                </p>
              </div>

              <Button
                onClick={handlePlaceOrder}
                className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold h-12 text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Place Order — {formatPrice(total)}
                  </>
                )}
              </Button>

              <Button variant="ghost" onClick={handleBack} className="w-full" disabled={loading}>
                Back to Summary
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </CustomerLayout>
  )
}
