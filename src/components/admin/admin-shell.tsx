'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Store, Settings, LayoutDashboard, ChevronRight, User as UserIcon, LogOut, ArrowLeft,
  Package, FolderOpen, ShoppingBag, Users, Truck, Tag, MapPin, BarChart3, Menu, PoundSterling,
  Clock, CalendarDays, Trash2, Image, UserCog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { authLogout } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Profile } from '@/types'
import { useStoreInfo } from '@/lib/store-info'

interface AdminShellProps {
  children: React.ReactNode
  profile: Profile
  userEmail: string
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/categories', label: 'Categories', icon: FolderOpen },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/drivers', label: 'Drivers', icon: Truck },
  { href: '/admin/employees', label: 'Employees', icon: UserCog },
  { href: '/admin/banners', label: 'Banners', icon: Image },
  { href: '/admin/attendance', label: 'Attendance', icon: Clock },
  { href: '/admin/shifts', label: 'Shifts', icon: CalendarDays },
  { href: '/admin/finance', label: 'Finance', icon: PoundSterling },
  { href: '/admin/wastage', label: 'Wastage', icon: Trash2 },
  { href: '/admin/promotions', label: 'Promotions', icon: Tag },
  { href: '/admin/delivery-zones', label: 'Delivery Zones', icon: MapPin },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

function getPageTitle(pathname: string): string {
  const item = navItems.find(
    (item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
  )
  return item?.label ?? 'Admin'
}

export function AdminShell({ children, profile, userEmail }: AdminShellProps) {
  const { store: storeInfo } = useStoreInfo()
  const storeName = storeInfo?.name || 'Fresh Mart'
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await authLogout()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Desktop Sidebar - unchanged */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 h-16 border-b border-gray-200">
          <Store className="h-6 w-6 text-[#16a34a]" />
          <div>
            <p className="font-bold text-gray-900 text-sm">{storeName} Admin</p>
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
              <UserIcon className="h-4 w-4 text-[#16a34a]" />
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
        <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-[#16a34a]" />
              <span className="font-bold text-sm text-gray-900">Admin</span>
              <Separator orientation="vertical" className="h-5 mx-1" />
              <span className="text-sm text-gray-600">{getPageTitle(pathname)}</span>
            </div>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:max-w-[280px] p-0 flex flex-col">
                <SheetHeader className="px-6 h-16 flex flex-row items-center gap-2 border-b border-gray-200 p-0 mx-0 mb-0">
                  <div className="flex items-center gap-2 px-6 w-full h-16">
                    <Store className="h-6 w-6 text-[#16a34a]" />
                    <div>
                      <SheetTitle className="font-bold text-gray-900 text-sm leading-tight">{storeName} Admin</SheetTitle>
                      <SheetDescription className="text-xs text-gray-500 leading-tight">Store Management</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href ||
                      (item.href !== '/admin' && pathname.startsWith(item.href))

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                          isActive
                            ? 'bg-[#16a34a]/10 text-[#16a34a]'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                        {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                      </Link>
                    )
                  })}
                </nav>

                {/* User Info & Actions */}
                <div className="border-t border-gray-200 p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-[#16a34a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full min-h-[44px]">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Store
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-h-[44px] text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        handleLogout()
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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
