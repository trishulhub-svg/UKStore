'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, DollarSign, User, Truck, LogOut, Wrench, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authLogout } from '@/lib/auth-client'
import { useStoreInfo } from '@/lib/store-info'
import { StoreLogo } from '@/components/layout/store-logo'
import { useEffect, useState } from 'react'
import type { AuthUser } from '@/lib/auth-client'
import { apiFetch } from '@/lib/api-fetch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ADMIN_TOOLS_ITEMS } from '@/lib/admin-nav-items'

// All driver nav items with their feature key.
// feature: null means always visible (no feature permission required).
const navItems = [
  { href: '/driver', label: 'Dashboard', icon: LayoutDashboard, feature: 'driver_dashboard' },
  { href: '/driver/earnings', label: 'Earnings', icon: DollarSign, feature: 'driver_earnings' },
  { href: '/driver/profile', label: 'Profile', icon: User, feature: 'driver_profile' },
]

// Admin-group feature keys — if the driver has ANY of these enabled,
// we show an "Admin Tools" button in the header that opens a sheet
// listing each enabled admin feature with a direct link to its
// /admin/<feature> page. We intentionally do NOT link to /admin
// root — that's blocked for picker/driver by middleware.
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

export function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { store } = useStoreInfo()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [enabledFeatures, setEnabledFeatures] = useState<string[] | null>(null)
  const [userRoles, setUserRoles] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  const storeName = store?.name || 'Fresh Mart'

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { authGetSession } = await import('@/lib/auth-client')
      const { user } = await authGetSession()
      if (cancelled) return
      setUser(user)
      // Fetch feature permissions AND the user's full role list (primary +
      // additional) from the server. The `roles` array lets dual-role staff
      // (e.g. a picker who is also a driver) access both dashboards.
      if (user) {
        try {
          const res = await apiFetch(`/api/user/permissions`, { redirectOn401: false })
          if (res.ok) {
            const data = await res.json()
            if (cancelled) return
            setEnabledFeatures(data.features)
            const roles: string[] = Array.isArray(data.roles)
              ? data.roles.map((r: unknown) => String(r).toUpperCase())
              : [String(user.role).toUpperCase()]
            setUserRoles(roles)
            // Redirect only if the user has NEITHER the driver role as primary
            // NOR as an additional role. Managers/Owners are also allowed.
            const hasDriver = roles.includes('DRIVER')
            const hasAdmin = roles.includes('MANAGER') || roles.includes('OWNER')
            if (!hasDriver && !hasAdmin) {
              router.push('/')
              return
            }
          } else {
            if (user.role.toLowerCase() !== 'driver') {
              router.push('/')
              return
            }
          }
        } catch {
          // Non-critical — fall back to primary role check
          if (user.role.toLowerCase() !== 'driver') {
            router.push('/')
            return
          }
        }
      }
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [router])

  const handleLogout = async () => {
    await authLogout()
    router.push('/')
  }

  // Filter nav items by feature permissions
  const visibleNavItems = navItems.filter((item) => {
    if (!item.feature) return true
    if (enabledFeatures === null) return true
    return enabledFeatures.includes(item.feature)
  })

  // Show "Admin Tools" button if the driver has any admin-group feature
  // enabled. null = full access → also show the button.
  // The button opens a Sheet listing each enabled admin feature as a
  // direct link to /admin/<feature>. We do NOT link to /admin root —
  // that's blocked for picker/driver by middleware (they'd be redirected
  // back to /driver). Admin features are surfaced in THEIR dashboard.
  const hasAdminAccess =
    enabledFeatures === null ||
    enabledFeatures.some((f) => ADMIN_FEATURE_KEYS.has(f))

  // Dual-role support: a driver who is ALSO a picker gets a "Switch to
  // Picker" button in the header. Both dashboards remain accessible by
  // URL too — this is just a convenience cross-link so they don't have
  // to type the URL. `userRoles` comes from /api/user/permissions
  // which returns the merged primary + additionalRoles array.
  const hasPickerRole = (() => {
    if (!userRoles) return false
    return userRoles.some((r) => r === 'PICKER')
  })()

  // Build the list of admin tool links to show in the sheet.
  const adminToolItems =
    enabledFeatures === null
      ? ADMIN_TOOLS_ITEMS
      : ADMIN_TOOLS_ITEMS.filter((item) =>
          item.feature && enabledFeatures.includes(item.feature),
        )

  const [adminToolsOpen, setAdminToolsOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Truck className="h-10 w-10 text-[#16a34a]" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // Determine driver access: either the user has DRIVER as a primary or
  // additional role, OR they're a manager/owner (admin fallback).
  const hasDriverAccess = (() => {
    if (!user) return false
    const primary = user.role.toLowerCase()
    if (primary === 'driver' || primary === 'manager' || primary === 'owner') return true
    if (userRoles && userRoles.some((r) => r === 'DRIVER' || r === 'MANAGER' || r === 'OWNER')) {
      return true
    }
    return false
  })()

  if (!user || !hasDriverAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <Truck className="h-12 w-12 text-[#16a34a] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Driver Access Required</h2>
          <p className="text-gray-600 mb-4">You need a driver account to access this area.</p>
          <Link href="/">
            <Button className="bg-[#16a34a] hover:bg-[#15803d] text-white">
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#16a34a] text-white shadow-md">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StoreLogo size={28} />
            <span className="font-bold text-base text-white">{storeName} Driver</span>
          </div>
          <div className="flex items-center gap-1">
            {hasPickerRole && (
              <Link
                href="/picker"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                title="Switch to Picker dashboard"
              >
                <Package className="h-4 w-4" />
                <span>Picker</span>
              </Link>
            )}
            {hasAdminAccess && adminToolItems.length > 0 && (
              <Sheet open={adminToolsOpen} onOpenChange={setAdminToolsOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                    title="Open admin tools"
                  >
                    <Wrench className="h-4 w-4" />
                    <span>Tools</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-[#16a34a]" />
                      Admin Tools
                    </SheetTitle>
                    <SheetDescription>
                      Quick access to the admin features you manage. You&apos;ll leave the driver dashboard — use the back arrow to return.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid grid-cols-2 gap-2 p-4">
                    {adminToolItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.feature}
                          href={item.href}
                          onClick={() => setAdminToolsOpen(false)}
                          className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-[#16a34a]/40 hover:bg-[#16a34a]/5 transition-colors min-h-[88px] justify-center"
                        >
                          <Icon className="h-6 w-6 text-[#16a34a]" />
                          <span className="text-xs font-medium text-gray-700 text-center">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </SheetContent>
              </Sheet>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full min-w-0 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/driver' && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                  isActive
                    ? 'text-[#16a34a]'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
