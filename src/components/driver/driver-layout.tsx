'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, DollarSign, User, Truck, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authLogout } from '@/lib/auth-client'
import { useStoreInfo } from '@/lib/store-info'
import { StoreLogo } from '@/components/layout/store-logo'
import { useEffect, useState } from 'react'
import type { AuthUser } from '@/lib/auth-client'
import { apiFetch } from '@/lib/api-fetch'

// All driver nav items with their feature key.
// feature: null means always visible (no feature permission required).
const navItems = [
  { href: '/driver', label: 'Dashboard', icon: LayoutDashboard, feature: 'driver_dashboard' },
  { href: '/driver/earnings', label: 'Earnings', icon: DollarSign, feature: 'driver_earnings' },
  { href: '/driver/profile', label: 'Profile', icon: User, feature: 'driver_profile' },
]

// Admin-group feature keys — if the driver has ANY of these enabled,
// we show an "Admin" link in the header so they can jump to /admin.
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

  // Show "Admin" link if the driver has any admin-group feature enabled.
  // null = full access → also show the link.
  const hasAdminAccess =
    enabledFeatures === null ||
    enabledFeatures.some((f) => ADMIN_FEATURE_KEYS.has(f))

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
            {hasAdminAccess && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                title="Open admin dashboard"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Admin</span>
              </Link>
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
