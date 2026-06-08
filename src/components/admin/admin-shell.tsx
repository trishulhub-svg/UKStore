'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Store, Settings, LayoutDashboard, ChevronRight, User, LogOut, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

interface AdminShellProps {
  children: React.ReactNode
  profile: Profile
  userEmail: string
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/settings', label: 'API Keys & Settings', icon: Settings },
]

export function AdminShell({ children, profile, userEmail }: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 h-16 border-b border-gray-200">
          <Store className="h-6 w-6 text-[#16a34a]" />
          <div>
            <p className="font-bold text-gray-900 text-sm">Fresh Mart Admin</p>
            <p className="text-xs text-gray-500">Store Management</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#16a34a]/10 text-[#16a34a]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {isActive && <ChevronRight className="h-3 w-3 ml-auto" />}
              </Link>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
              <User className="h-4 w-4 text-[#16a34a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <ArrowLeft className="h-3 w-3 mr-1" />
                Store
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={handleLogout}
            >
              <LogOut className="h-3 w-3 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64 flex-1">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-[#16a34a]" />
              <span className="font-bold text-sm text-gray-900">Admin</span>
            </div>
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="icon"
                      className={isActive ? 'bg-[#16a34a] hover:bg-[#15803d]' : ''}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </Link>
                )
              })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
