'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Mail, Calendar, ShoppingBag, LogOut, ChevronRight, Package, Clock, MapPin, Settings, KeyRound, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { authLogout } from '@/lib/auth-client'
import { formatPrice } from '@/lib/vat'
import { apiFetch } from '@/lib/api-fetch'
import type { Order } from '@/types'

interface AccountClientProps {
  storeName: string
  user: {
    id: string
    email: string
    name: string
    createdAt: string
    role: string
  }
  orders: Order[]
}

// Admin-group feature keys — if the user has ANY of these enabled
// (or full access), we show the "Admin Dashboard" link on /account.
// This mirrors the logic in picker-layout.tsx / driver-layout.tsx so
// the link visibility is consistent across every dashboard the
// employee can reach. We intentionally do NOT import this set from
// `@/lib/feature-permissions` because that module pulls in server-only
// code (Prisma / NextResponse) which would balloon the client bundle.
const ADMIN_FEATURE_KEYS = new Set([
  'admin_dashboard',
  'kanban',
  'orders',
  'products',
  'categories',
  'customers',
  'drivers',
  'employees',
  'banners',
  'shifts',
  'finance',
  'wastage',
  'promotions',
  'delivery_zones',
  'analytics',
  'settings',
])

const statusColors: Record<string, string> = {
  placed: 'bg-blue-50 text-blue-700 border-blue-200',
  picking: 'bg-amber-50 text-amber-700 border-amber-200',
  ready: 'bg-purple-50 text-purple-700 border-purple-200',
  out_for_delivery: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

const statusLabels: Record<string, string> = {
  placed: 'Placed',
  picking: 'Being Picked',
  ready: 'Ready for Delivery',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const deliverySlotLabels: Record<string, string> = {
  'today-4-6': 'Today 4-6pm',
  'today-6-8': 'Today 6-8pm',
  'tomorrow-10-12': 'Tomorrow 10am-12pm',
  'tomorrow-12-2': 'Tomorrow 12-2pm',
}

export function AccountClient({ storeName, user, orders }: AccountClientProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  // ─── Feature-permission check for the "Admin Dashboard" link ─────────
  // The link must only appear if the user actually has admin features
  // enabled. A MANAGER whose admin features have all been toggled off
  // (or a dual-role PICKER+MANAGER with no admin features) should NOT
  // see the link. OWNER always has full access. null = full access
  // (default-open when no EmployeeFeaturePermission row exists).
  const [enabledFeatures, setEnabledFeatures] = useState<string[] | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/user/permissions', { redirectOn401: false })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setEnabledFeatures(data.features)
      })
      .catch(() => {
        // Non-critical — fail CLOSED (treat as "no features enabled")
        // so a transient network error never accidentally exposes the
        // admin link to a restricted employee. The owner can still
        // reach /admin directly via URL.
        if (!cancelled) setEnabledFeatures([])
      })
    return () => { cancelled = true }
  }, [])

  const isOwner = user.role.toUpperCase() === 'OWNER'
  // OWNER → always full access. Otherwise: null = full access (default open),
  // array = must contain at least one admin-group feature.
  const hasAdminAccess =
    isOwner ||
    enabledFeatures === null ||
    (Array.isArray(enabledFeatures) && enabledFeatures.some((f) => ADMIN_FEATURE_KEYS.has(f)))

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await authLogout()
      router.push('/')
      router.refresh()
    } catch {
      setLoggingOut(false)
    }
  }

  return (
    <CustomerLayout storeName={storeName}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">My Account</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="text-center pb-3">
                <div className="w-16 h-16 rounded-full bg-[#16a34a]/10 flex items-center justify-center mx-auto mb-3">
                  <User className="h-8 w-8 text-[#16a34a]" />
                </div>
                <CardTitle className="text-lg">{user.name || 'Customer'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600 truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">
                    Joined {new Date(user.createdAt).toLocaleDateString('en-GB', {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </span>
                </div>
                <Separator className="my-3" />
                {/* Profile / change password */}
                <Link href="/account/profile" className="block">
                  <Button variant="outline" className="w-full mb-2">
                    <UserCircle className="h-4 w-4 mr-2" />
                    My Profile &amp; Settings
                  </Button>
                </Link>
                {/* Admin link — only when the user actually has admin
                    feature access. OWNER always qualifies; MANAGER /
                    dual-role staff only qualify when at least one
                    admin-group feature is enabled (or they have full
                    access). This prevents a restricted employee from
                    seeing a link they can't actually use. */}
                {hasAdminAccess && (
                  <Link href="/admin" className="block">
                    <Button variant="outline" className="w-full mb-2 border-[#16a34a]/30 text-[#16a34a] hover:bg-[#16a34a]/5">
                      <Settings className="h-4 w-4 mr-2" />
                      Admin Dashboard
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Order History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-[#16a34a]" />
                  Order History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No orders yet</p>
                    <p className="text-sm text-gray-400 mt-1">Start shopping to see your orders here</p>
                    <Link href="/catalog">
                      <Button className="mt-4 bg-[#f97316] hover:bg-[#ea580c] text-white">
                        Start Shopping
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {orders.map((order) => (
                      <Link key={order.id} href={`/order/${order.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-[#16a34a]/30 hover:shadow-sm transition-all cursor-pointer gap-2">
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <Package className="h-5 w-5 text-gray-500" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900">
                                Order #{order.id.substring(0, 8).toUpperCase()}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(order.created_at).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                                {order.delivery_slot && (
                                  <span className="text-xs text-gray-500">
                                    {deliverySlotLabels[order.delivery_slot] || order.delivery_slot}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 sm:ml-auto">
                            <Badge
                              variant="outline"
                              className={`text-xs ${statusColors[order.status] || 'bg-gray-50 text-gray-700'}`}
                            >
                              {statusLabels[order.status] || order.status}
                            </Badge>
                            <span className="font-semibold text-sm">{formatPrice(order.total)}</span>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CustomerLayout>
  )
}
