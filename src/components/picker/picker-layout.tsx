'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Package, Clock, User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authLogout } from '@/lib/auth-client'
import { useStoreInfo } from '@/lib/store-info'
import { useEffect, useState } from 'react'
import type { AuthUser } from '@/lib/auth-client'
import { ClockInOutButton } from '@/components/shared/clock-in-out-button'

const navItems = [
  { href: '/picker', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/picker/packing', label: 'Packing', icon: Package },
  { href: '/picker/attendance', label: 'Attendance', icon: Clock },
  { href: '/picker/profile', label: 'Profile', icon: User },
]

export function PickerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/lib/auth-client').then(({ authGetSession }) => {
      authGetSession().then(({ user }) => {
        setUser(user)
        setLoading(false)
        if (user && user.role.toLowerCase() !== 'picker') {
          router.push('/')
        }
      })
    })
  }, [router])

  const handleLogout = async () => {
    await authLogout()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Package className="h-10 w-10 text-orange-500" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role.toLowerCase() !== 'picker') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <Package className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Picker Access Required</h2>
          <p className="text-gray-600 mb-4">You need a picker account to access this area.</p>
          <Link href="/">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-orange-500 text-white shadow-md">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <span className="font-bold text-base">{useStoreInfo().store?.name || 'Fresh Mart'} Picker</span>
          </div>
          <div className="flex items-center gap-2">
            <ClockInOutButton variant="compact" />
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
      <main className="flex-1 max-w-lg mx-auto w-full pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/picker' && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                  isActive
                    ? 'text-orange-500'
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
