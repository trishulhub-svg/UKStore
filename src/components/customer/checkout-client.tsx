'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, MapPin, Clock, ShoppingBag, CreditCard, ChevronRight, Loader2, Banknote, Building2, Info, Tag, X, Navigation, AlertTriangle } from 'lucide-react'
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
import { calculateDeliveryFee } from '@/lib/delivery'
import { useDeliveryLocation, geocodeAddress } from '@/lib/delivery-location'
import type { Store, Address } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

interface CheckoutClientProps {
  store: Store
  user: { id: string; email: string; name: string }
  addresses: Address[]
}

type PaymentMethod = 'card' | 'cash' | 'bank_transfer'

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

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [bankTransferRef, setBankTransferRef] = useState('')

  // Bank details (will be returned from the API after order creation)
  const [bankDetails, setBankDetails] = useState<{ sortCode: string; accountNumber: string; accountName: string } | null>(null)

  // Promo code state
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string
    discount: number
    promotionName: string
    promotionId: string
    discountType: string
    discountValue: number
  } | null>(null)

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

  // Delivery fee calculation using real distance from delivery location context
  const deliveryLocation = useDeliveryLocation()
  const contextDistanceKm = deliveryLocation.location.distanceKm
  const isWithinZone = deliveryLocation.location.isWithinDeliveryZone
  const hasLocation = deliveryLocation.location.latitude !== null && deliveryLocation.location.longitude !== null

  // When on the address step, we'll geocode the entered address separately
  // Use context distance as default, but can be overridden by address step geocoding
  const [addressDistanceKm, setAddressDistanceKm] = useState<number | null>(null)
  const [addressWithinZone, setAddressWithinZone] = useState<boolean | null>(null)
  const [geocodingAddress, setGeocodingAddress] = useState(false)

  // Use address-specific distance if available, otherwise context distance
  const effectiveDistanceKm = addressDistanceKm ?? contextDistanceKm
  const effectiveWithinZone = addressWithinZone !== null ? addressWithinZone : isWithinZone

  const deliveryPricing = effectiveDistanceKm !== null
    ? calculateDeliveryFee({
        base_delivery_fee: store.base_delivery_fee,
        per_km_charge: store.per_km_charge,
        free_delivery_threshold: store.free_delivery_threshold,
        delivery_radius_km: store.delivery_radius_km,
        order_subtotal: subtotal,
        distance_km: effectiveDistanceKm,
      })
    : null

  const deliveryFee = deliveryPricing
    ? deliveryPricing.delivery_fee
    : (subtotal >= store.free_delivery_threshold ? 0 : store.base_delivery_fee)
  const isFreeDelivery = deliveryPricing ? deliveryPricing.is_free_delivery : (subtotal >= store.free_delivery_threshold)
  const promoDiscount = appliedPromo?.discount || 0
  const total = subtotal + deliveryFee - promoDiscount

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

  const handleNext = async () => {
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

      // Geocode the delivery address to check delivery zone
      setGeocodingAddress(true)
      try {
        const fullAddress = [addressLine1, addressLine2, city, postcode].filter(Boolean).join(', ')
        const geoResult = await geocodeAddress(fullAddress, postcode)

        if (geoResult) {
          // Update the delivery location context with the new address
          deliveryLocation.setManualAddress(fullAddress, postcode, geoResult.latitude, geoResult.longitude)

          // Calculate distance inline for immediate feedback
          const R = 6371
          const dLat = ((geoResult.latitude - store.latitude) * Math.PI) / 180
          const dLon = ((geoResult.longitude - store.longitude) * Math.PI) / 180
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((store.latitude * Math.PI) / 180) *
              Math.cos((geoResult.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const dist = Math.round((R * c) * 10) / 10
          const within = dist <= store.delivery_radius_km

          setAddressDistanceKm(dist)
          setAddressWithinZone(within)

          if (!within) {
            setError({
              message: `This address is ${dist}km from our store, which is outside our ${store.delivery_radius_km}km delivery zone.`,
              code: 'OUTSIDE_DELIVERY_ZONE',
              details: 'Please enter a delivery address within our delivery area, or contact us for special arrangements.',
              timestamp: new Date().toISOString(),
            })
            setGeocodingAddress(false)
            return
          }
        } else {
          // Could not geocode - allow to proceed but warn
          toast.warning('Could not verify delivery address location. Delivery fee may be adjusted.')
        }
      } catch {
        // Geocoding failed - allow to proceed
        toast.warning('Could not verify delivery address. Proceeding anyway.')
      } finally {
        setGeocodingAddress(false)
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

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    try {
      const categoryIds = [...new Set(items.map((item) => item.product.category?.id).filter(Boolean))] as string[]
      const res = await apiFetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode.trim(),
          subtotal,
          categoryIds,
        }),
      })
      const data = await res.json()

      if (data.valid) {
        setAppliedPromo({
          code: promoCode.trim(),
          discount: data.discount,
          promotionName: data.promotionName,
          promotionId: data.promotionId,
          discountType: data.discountType,
          discountValue: data.discountValue,
        })
        toast.success(`Promo code applied! You save ${formatPrice(data.discount)}`)
      } else {
        toast.error(data.message || 'Invalid promo code')
        setAppliedPromo(null)
      }
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to validate promo code. Please try again.')
      }

    } finally {
      setPromoLoading(false)
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromo(null)
    setPromoCode('')
    toast.info('Promo code removed')
  }

  const handlePlaceOrder = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/checkout', {
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
          payment_method: paymentMethod,
          bank_transfer_ref: bankTransferRef || undefined,
          promo_code: appliedPromo?.code || undefined,
          promotion_id: appliedPromo?.promotionId || undefined,
          discount_amount: promoDiscount || undefined,
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

      // Store bank details if returned
      if (data.bankDetails) {
        setBankDetails(data.bankDetails)
      }

      // For card payment with Stripe, redirect to checkout URL
      if (paymentMethod === 'card' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      // For cash and bank transfer, go directly to order confirmation
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
      <CustomerLayout storeName={store.name} store={store}>
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
    <CustomerLayout storeName={store.name} store={store}>
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
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? 'bg-[#16a34a] border-[#16a34a] text-white'
                          : isCurrent
                          ? 'bg-white border-[#16a34a] text-[#16a34a]'
                          : 'bg-white border-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <Icon className="h-4 w-4 sm:h-5 sm:w-5" />}
                    </div>
                    <span
                      className={`hidden sm:block text-xs mt-1.5 font-medium ${
                        isCurrent ? 'text-[#16a34a]' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 sm:mx-2 mt-[-0.75rem] sm:mt-[-1.25rem] ${
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

              {/* Delivery Zone Info */}
              {addressDistanceKm !== null && (
                <div className={`rounded-lg px-4 py-3 flex items-start gap-3 ${
                  effectiveWithinZone
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {effectiveWithinZone ? (
                    <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${effectiveWithinZone ? 'text-green-700' : 'text-red-700'}`}>
                      {effectiveWithinZone
                        ? `Within delivery zone — ${addressDistanceKm}km from store`
                        : `Outside delivery zone — ${addressDistanceKm}km from store (max: ${store.delivery_radius_km}km)`}
                    </p>
                    {!isFreeDelivery && effectiveWithinZone && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Delivery fee: {formatPrice(store.base_delivery_fee)} + {formatPrice(store.per_km_charge)} x {addressDistanceKm}km = {formatPrice(deliveryFee)}
                      </p>
                    )}
                    {isFreeDelivery && effectiveWithinZone && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Free delivery (order over {formatPrice(store.free_delivery_threshold)})
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleNext}
                  disabled={geocodingAddress}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                >
                  {geocodingAddress ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying Address...
                    </>
                  ) : (
                    <>
                      Continue to Delivery Slot
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
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

              {/* Promo Code Section */}
              <div>
                <h3 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-[#16a34a]" />
                  Promo Code
                </h3>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-[#16a34a]/5 border border-[#16a34a]/20 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-[#16a34a]">{appliedPromo.promotionName}</p>
                      <p className="text-xs text-gray-500">
                        Code: <span className="font-mono uppercase">{appliedPromo.code}</span> &middot; Save {formatPrice(appliedPromo.discount)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePromo}
                      className="text-gray-400 hover:text-red-500 h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter promo code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="uppercase font-mono flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyPromo()
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyPromo}
                      disabled={promoLoading || !promoCode.trim()}
                      className="shrink-0"
                    >
                      {promoLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  </div>
                )}
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
                {appliedPromo && promoDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#16a34a] flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      {appliedPromo.promotionName}
                    </span>
                    <span className="text-[#16a34a] font-medium">-{formatPrice(promoDiscount)}</span>
                  </div>
                )}
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
              {/* Total amount */}
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

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">Select Payment Method</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
                  className="space-y-3"
                >
                  {/* Card Payment (Stripe) */}
                  <Label
                    htmlFor="payment-card"
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      paymentMethod === 'card'
                        ? 'border-[#16a34a] bg-[#16a34a]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <RadioGroupItem value="card" id="payment-card" />
                    <CreditCard className="h-5 w-5 text-gray-600 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Card Payment</p>
                      <p className="text-xs text-gray-500">Pay securely with Stripe — Visa, Mastercard, Amex</p>
                    </div>
                    <span className="text-xs text-gray-400">Free</span>
                  </Label>

                  {/* Cash on Delivery */}
                  <Label
                    htmlFor="payment-cash"
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      paymentMethod === 'cash'
                        ? 'border-[#16a34a] bg-[#16a34a]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <RadioGroupItem value="cash" id="payment-cash" />
                    <Banknote className="h-5 w-5 text-gray-600 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Cash on Delivery</p>
                      <p className="text-xs text-gray-500">Pay with cash when your order arrives</p>
                    </div>
                    <span className="text-xs text-gray-400">Free</span>
                  </Label>

                  {/* Bank Transfer */}
                  <Label
                    htmlFor="payment-bank"
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-[#16a34a] bg-[#16a34a]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <RadioGroupItem value="bank_transfer" id="payment-bank" />
                    <Building2 className="h-5 w-5 text-gray-600 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Bank Transfer</p>
                      <p className="text-xs text-gray-500">Transfer directly to our bank account</p>
                    </div>
                    <span className="text-xs text-gray-400">Free</span>
                  </Label>
                </RadioGroup>
              </div>

              {/* Card Payment Info */}
              {paymentMethod === 'card' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> You will be redirected to Stripe&apos;s secure checkout to complete payment.
                    {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
                      <><br /><strong>Demo Mode:</strong> Stripe is not configured. Payment will be simulated.</>
                    )}
                  </p>
                </div>
              )}

              {/* Cash on Delivery Info */}
              {paymentMethod === 'cash' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Banknote className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Cash on Delivery</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Please have the exact amount ready: <strong>{formatPrice(total)}</strong>. 
                        Our driver will collect payment upon delivery. No additional fees apply.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Transfer Info */}
              {paymentMethod === 'bank_transfer' && (
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Building2 className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-800">Bank Transfer</p>
                        <p className="text-xs text-purple-700 mt-1">
                          Your order will be placed and you&apos;ll receive bank details to complete the transfer.
                          Payment must be received before delivery can be dispatched.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reference number input */}
                  <div className="space-y-2">
                    <Label htmlFor="bankRef" className="text-sm font-medium text-gray-700">
                      Payment Reference (Optional)
                    </Label>
                    <Input
                      id="bankRef"
                      placeholder="e.g., Your bank transfer reference"
                      value={bankTransferRef}
                      onChange={(e) => setBankTransferRef(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Add a reference to help us match your payment faster
                    </p>
                  </div>
                </div>
              )}

              {/* Place Order Button */}
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
                ) : paymentMethod === 'card' ? (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Pay with Card — {formatPrice(total)}
                  </>
                ) : paymentMethod === 'cash' ? (
                  <>
                    <Banknote className="h-5 w-5 mr-2" />
                    Place Order (Cash on Delivery)
                  </>
                ) : (
                  <>
                    <Building2 className="h-5 w-5 mr-2" />
                    Place Order (Bank Transfer)
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
