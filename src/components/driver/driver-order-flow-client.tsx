'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2,
  Circle,
  Package,
  Truck,
  MapPin,
  Phone,
  ArrowLeft,
  Camera,
  PenLine,
  AlertCircle,
  ShieldAlert,
  UserCheck,
  X,
  RotateCcw,
  Upload,
  Image as ImageIcon,
} from 'lucide-react'

interface ProductInfo {
  id: string
  name: string
  imageUrl: string | null
  barcode: string | null
  category: { name: string } | null
  isHfss?: boolean
}

interface OrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  picked: boolean
  product: ProductInfo | null
}

interface CustomerInfo {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface AddressInfo {
  id: string
  addressLine1: string
  addressLine2: string | null
  city: string
  postcode: string
}

interface Order {
  id: string
  status: string
  total: number
  deliveryFee: number
  subtotal: number
  notes: string | null
  hasChallenge25: boolean
  challenge25Verified: boolean
  paymentMethod: string | null
  createdAt: string
  customer: CustomerInfo
  address: AddressInfo
  items: OrderItem[]
}

const statusSteps = [
  { key: 'placed', label: 'Placed', icon: Package },
  { key: 'picking', label: 'Picking', icon: Package },
  { key: 'ready', label: 'Packed', icon: CheckCircle2 },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

export function DriverOrderFlowClient() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showConfirmDelivery, setShowConfirmDelivery] = useState(false)

  // Delivery proof state
  const [deliveryPhoto, setDeliveryPhoto] = useState<string | null>(null)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const signatureCanvasRef = useState<React.RefObject<HTMLCanvasElement | null>>(() => ({ current: null }))[0]

  // Challenge 25 state
  const [showChallenge25, setShowChallenge25] = useState(false)
  const [birthYear, setBirthYear] = useState('')
  const [challenge25Error, setChallenge25Error] = useState('')

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      }
    } catch (err) {
      console.error('Failed to fetch order:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const handleMarkPicked = async (itemId: string) => {
    setActionLoading(itemId)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, picked: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      }
    } catch (err) {
      console.error('Failed to mark as picked:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleClaimOrder = async () => {
    setActionLoading('claim')
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignToMe: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      }
    } catch (err) {
      console.error('Failed to claim order:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    setActionLoading(newStatus)
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, assignToMe: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirmDelivery = async () => {
    setActionLoading('deliver')
    try {
      const res = await fetch(`/api/driver/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryPhotoUrl: deliveryPhoto,
          signatureUrl: signatureData,
        }),
      })
      if (res.ok) {
        router.push('/driver')
      }
    } catch (err) {
      console.error('Failed to confirm delivery:', err)
    } finally {
      setActionLoading(null)
      setShowConfirmDelivery(false)
    }
  }

  // Photo capture handler
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setDeliveryPhoto(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Signature pad handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    let x: number, y: number

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    let x: number, y: number

    if ('touches' in e) {
      e.preventDefault()
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1f2937'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    // Save signature as data URL
    const canvas = signatureCanvasRef.current
    if (canvas) {
      setSignatureData(canvas.toDataURL('image/png'))
    }
  }

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureData(null)
  }

  // Challenge 25 verification
  const handleVerifyChallenge25 = async () => {
    setChallenge25Error('')

    const year = parseInt(birthYear, 10)
    const currentYear = new Date().getFullYear()

    if (!birthYear || isNaN(year) || year < 1900 || year > currentYear) {
      setChallenge25Error('Please enter a valid birth year.')
      return
    }

    const age = currentYear - year
    if (age < 18) {
      setChallenge25Error('Customer must be 18 or older to receive this order. Sale refused.')
      return
    }

    setActionLoading('challenge25')
    try {
      const res = await fetch(`/api/driver/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge25Verified: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setOrder(data.order)
        setShowChallenge25(false)
        setBirthYear('')
      }
    } catch (err) {
      console.error('Failed to verify Challenge 25:', err)
      setChallenge25Error('Failed to verify. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-24" />
        ))}
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">Order not found</p>
        <Button variant="outline" onClick={() => router.push('/driver')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const allPicked = order.items.every((item) => item.picked)
  const pickedCount = order.items.filter((item) => item.picked).length
  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status)

  // Identify HFSS items in the order for Challenge 25 display
  const hfssItems = order.items.filter(
    (item) => item.product?.isHfss
  )

  // Determine if Challenge 25 needs to be shown
  const needsChallenge25 = order.hasChallenge25 && !order.challenge25Verified && order.status === 'out_for_delivery'

  return (
    <div className="p-4 space-y-4">
      {/* Back Button & Title */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/driver')} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-bold text-lg text-gray-900">Order #{order.id.slice(-8)}</h1>
          <p className="text-xs text-gray-500">
            {new Date(order.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Challenge 25 Warning Banner */}
      {order.hasChallenge25 && !order.challenge25Verified && (
        <Card className="shadow-sm border-amber-300 bg-amber-50">
          <CardContent className="p-3 flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Challenge 25 — Age Verification Required</p>
              <p className="text-xs text-amber-700">
                This order contains age-restricted items. Verify customer ID before delivery.
              </p>
            </div>
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100 text-xs">
              Pending
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Challenge 25 Verified Banner */}
      {order.hasChallenge25 && order.challenge25Verified && (
        <Card className="shadow-sm border-green-300 bg-green-50">
          <CardContent className="p-3 flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-green-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">Challenge 25 — Age Verified</p>
              <p className="text-xs text-green-700">Customer ID has been verified. Safe to deliver.</p>
            </div>
            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-100 text-xs">
              Verified
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Status Timeline */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            {statusSteps.map((step, i) => {
              const isCompleted = i <= currentStepIndex
              const isCurrent = i === currentStepIndex
              const Icon = step.icon

              return (
                <div key={step.key} className="flex flex-col items-center flex-1 relative">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mb-1 ${
                      isCompleted
                        ? 'bg-[#16a34a] text-white'
                        : 'bg-gray-100 text-gray-400'
                    } ${isCurrent ? 'ring-2 ring-[#16a34a]/30' : ''}`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs text-center leading-tight ${
                      isCompleted ? 'text-[#16a34a] font-semibold' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {i < statusSteps.length - 1 && (
                    <div
                      className={`absolute top-[12px] sm:top-[14px] left-1/2 w-full h-0.5 ${
                        i < currentStepIndex ? 'bg-[#16a34a]' : 'bg-gray-200'
                      }`}
                      style={{ zIndex: -1, transform: 'translateX(50%)' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Customer & Delivery Info */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700">Delivery Details</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-[#16a34a] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-gray-900">{order.address.addressLine1}</p>
              {order.address.addressLine2 && (
                <p className="text-sm text-gray-600">{order.address.addressLine2}</p>
              )}
              <p className="text-sm text-gray-600">{order.address.city} {order.address.postcode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#16a34a] shrink-0" />
            <span className="text-sm text-gray-900">{order.customer.name}</span>
            {order.customer.phone && (
              <span className="text-sm text-gray-500">· {order.customer.phone}</span>
            )}
          </div>
          {order.paymentMethod && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Payment:</span>
              <Badge variant="outline" className="text-xs capitalize">
                {order.paymentMethod === 'cash' ? 'Cash on Delivery' :
                 order.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                 'Card Payment'}
              </Badge>
            </div>
          )}
          {order.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
              <p className="text-xs font-medium text-amber-800">📝 Customer Note</p>
              <p className="text-xs text-amber-700">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claim Order Button (if not assigned) */}
      {order.status === 'picking' || order.status === 'ready' ? (
        <Button
          onClick={handleClaimOrder}
          disabled={actionLoading === 'claim'}
          className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-10"
        >
          {actionLoading === 'claim' ? 'Claiming...' : 'Claim This Order'}
        </Button>
      ) : null}

      {/* Pick List */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700">Pick List</CardTitle>
            <Badge variant="outline" className="text-xs">
              {pickedCount}/{order.items.length} picked
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                item.picked
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <button
                onClick={() => !item.picked && handleMarkPicked(item.id)}
                disabled={item.picked || actionLoading === item.id}
                className="shrink-0"
              >
                {item.picked ? (
                  <CheckCircle2 className="h-6 w-6 text-[#16a34a]" />
                ) : (
                  <Circle className="h-6 w-6 text-gray-300 hover:text-[#16a34a] transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.picked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.productName}
                  {item.product?.isHfss && (
                    <span className="ml-1.5 text-xs text-amber-600 font-normal">(Age-restricted)</span>
                  )}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Qty: {item.quantity}</span>
                  {item.product?.category && (
                    <>
                      <span>·</span>
                      <span>{item.product.category.name}</span>
                    </>
                  )}
                  {item.product?.barcode && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{item.product.barcode}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-gray-700">
                £{(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* When picking: show "Order Packed" when all items picked */}
        {order.status === 'picking' && allPicked && (
          <Button
            onClick={() => handleUpdateStatus('ready')}
            disabled={actionLoading === 'ready'}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-12 text-base"
          >
            <Package className="h-5 w-5 mr-2" />
            {actionLoading === 'ready' ? 'Updating...' : 'Mark Order as Packed'}
          </Button>
        )}

        {order.status === 'picking' && !allPicked && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">
              Pick all items to mark as packed ({pickedCount}/{order.items.length})
            </p>
          </div>
        )}

        {/* When ready: show "Start Delivery" */}
        {order.status === 'ready' && (
          <Button
            onClick={() => handleUpdateStatus('out_for_delivery')}
            disabled={actionLoading === 'out_for_delivery'}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-12 text-base"
          >
            <Truck className="h-5 w-5 mr-2" />
            {actionLoading === 'out_for_delivery' ? 'Starting...' : 'Start Delivery'}
          </Button>
        )}

        {/* When out for delivery: Challenge 25 verification (if needed) */}
        {needsChallenge25 && !showChallenge25 && !showConfirmDelivery && (
          <Card className="shadow-sm border-amber-300 bg-amber-50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <ShieldAlert className="h-5 w-5" />
                Challenge 25 — Age Verification Required
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <p className="text-sm text-amber-700">
                This order contains age-restricted items (HFSS). You must verify the customer&apos;s age before completing delivery.
              </p>
              {hfssItems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-800">Age-restricted items:</p>
                  <ul className="list-disc list-inside text-xs text-amber-700">
                    {hfssItems.map((item) => (
                      <li key={item.id}>{item.productName} × {item.quantity}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                onClick={() => setShowChallenge25(true)}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white h-10"
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Verify Customer Age
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Challenge 25 Verification Form */}
        {showChallenge25 && (
          <Card className="shadow-sm border-amber-300">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <UserCheck className="h-5 w-5 text-amber-600" />
                Verify Customer Age
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>UK Challenge 25 Policy:</strong> Ask for ID if the customer looks under 25.
                  Verify they are 18 or older for age-restricted products.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthYear" className="text-sm font-medium">
                  Customer&apos;s Year of Birth
                </Label>
                <Input
                  id="birthYear"
                  type="number"
                  placeholder="e.g., 1995"
                  value={birthYear}
                  onChange={(e) => {
                    setBirthYear(e.target.value)
                    setChallenge25Error('')
                  }}
                  min={1900}
                  max={new Date().getFullYear()}
                  className="h-10"
                />
                {birthYear && !isNaN(parseInt(birthYear)) && (
                  <p className="text-xs text-gray-500">
                    Customer age: {new Date().getFullYear() - parseInt(birthYear)} years old
                    {new Date().getFullYear() - parseInt(birthYear) >= 18 ? (
                      <span className="text-green-600 ml-1">✓ Eligible</span>
                    ) : (
                      <span className="text-red-600 ml-1">✗ Under 18 — Sale refused</span>
                    )}
                  </p>
                )}
              </div>
              {challenge25Error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <p className="text-sm text-red-700">{challenge25Error}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowChallenge25(false)
                    setBirthYear('')
                    setChallenge25Error('')
                  }}
                  className="flex-1 h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVerifyChallenge25}
                  disabled={actionLoading === 'challenge25' || !birthYear}
                  className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white h-10"
                >
                  {actionLoading === 'challenge25' ? 'Verifying...' : 'Confirm ID Verified'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* When out for delivery: show "Confirm Delivery" (only after Challenge 25 if required) */}
        {order.status === 'out_for_delivery' && !showConfirmDelivery && !needsChallenge25 && (
          <Button
            onClick={() => setShowConfirmDelivery(true)}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-12 text-base"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Confirm Delivery
          </Button>
        )}

        {/* Also show when Challenge 25 is verified */}
        {order.status === 'out_for_delivery' && order.hasChallenge25 && order.challenge25Verified && !showConfirmDelivery && (
          <Button
            onClick={() => setShowConfirmDelivery(true)}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-12 text-base"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Confirm Delivery
          </Button>
        )}

        {/* Delivery Confirmation Dialog with Photo Proof & Signature */}
        {showConfirmDelivery && (
          <Card className="shadow-sm border-[#16a34a]/20">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-gray-700">Confirm Delivery</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Photo Proof Section */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photo Proof of Delivery
                </Label>
                {deliveryPhoto ? (
                  <div className="relative">
                    <img
                      src={deliveryPhoto}
                      alt="Delivery proof"
                      className="w-full h-48 object-cover rounded-lg border border-gray-200"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => setDeliveryPhoto(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoCapture}
                      className="hidden"
                      id="delivery-photo-input"
                    />
                    <label
                      htmlFor="delivery-photo-input"
                      className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-6 text-gray-400 hover:border-[#16a34a] hover:text-[#16a34a] transition-colors cursor-pointer"
                    >
                      <Camera className="h-8 w-8" />
                      <span className="text-sm font-medium">Take Photo</span>
                      <span className="text-xs">Opens your camera to take a delivery photo</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Signature Section */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <PenLine className="h-4 w-4" />
                  Customer Signature
                </Label>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={signatureCanvasRef}
                    width={400}
                    height={150}
                    className="w-full touch-none"
                    style={{ height: '150px' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">Sign above with finger or mouse</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-gray-500"
                    onClick={clearSignature}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Proof Status Summary */}
              <div className="flex items-center gap-2">
                {deliveryPhoto && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Photo captured
                  </Badge>
                )}
                {signatureData && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    <PenLine className="h-3 w-3 mr-1" />
                    Signature captured
                  </Badge>
                )}
                {!deliveryPhoto && !signatureData && (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                    No proof captured
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfirmDelivery(false)
                    setDeliveryPhoto(null)
                    clearSignature()
                  }}
                  className="flex-1 h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDelivery}
                  disabled={actionLoading === 'deliver'}
                  className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white h-10"
                >
                  {actionLoading === 'deliver' ? 'Confirming...' : 'Confirm Delivered'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order delivered */}
        {order.status === 'delivered' && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-[#16a34a] mx-auto mb-2" />
            <p className="font-semibold text-gray-900">Order Delivered!</p>
            <Button variant="outline" onClick={() => router.push('/driver')} className="mt-3">
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
