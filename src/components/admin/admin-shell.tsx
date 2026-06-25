'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Settings, LayoutDashboard, ChevronRight, User as UserIcon, LogOut, ArrowLeft,
  Menu, PoundSterling, UserCog, UserCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { authLogout } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Profile } from '@/types'
import { useStoreInfo } from '@/lib/store-info'
import { StoreLogo } from '@/components/layout/store-logo'
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav-items'

interface AdminShellProps {
  children: React.ReactNode
  profile: Profile
  userEmail: string
  userRole?: string
  /** List of feature keys the user can access. null = full access (no restrictions). */
  enabledFeatures?: string[] | null
}

// Use the shared admin nav items. The Dashboard item (feature=null) is
// always visible; others are filtered by enabledFeatures below.
const navItems = ADMIN_NAV_ITEMS

function getPageTitle(pathname: string): string {
  const item = navItems.find(
    (item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
  )
  return item?.label ?? 'Admin'
}

export function AdminShell({ children, profile, userEmail, userRole, enabledFeatures }: AdminShellProps) {
  const { store: storeInfo } = useStoreInfo()
  const storeName = storeInfo?.name || 'Fresh Mart'
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Filter nav items based on feature permissions.
  // enabledFeatures === null means the user has full access (no restrictions).
  // enabledFeatures === [...] means only those features are visible.
  const visibleNavItems = navItems.filter((item) => {
    if (!item.feature) return true // Dashboard is always visible
    if (enabledFeatures === null || enabledFeatures === undefined) return true
    return enabledFeatures.includes(item.feature)
  })

  const handleLogout = async () => {
    await authLogout()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-x-hidden">
      {/* Desktop Sidebar - unchanged */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 h-16 border-b border-gray-200 flex-shrink-0">
          <StoreLogo size={32} />
          <div>
            <p className="font-bold text-gray-900 text-sm">{storeName} Admin</p>
            <p className="text-xs text-gray-500">Store Management</p>
          </div>
        </div>
        {/* Fresh gradient strip under the logo — brand presence */}
        <div className="fm-sidebar-strip flex-shrink-0" aria-hidden="true" />

        {/* Navigation — vertically scrollable when content overflows */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto overflow-x-hidden min-h-0">
          {visibleNavItems.map((item) => {
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
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0">
              <UserIcon className="h-4 w-4 text-[#16a34a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              {userRole && (
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">
                  {userRole}
                  {enabledFeatures !== null && enabledFeatures !== undefined && (
                    <span className="ml-1 text-amber-600">· Restricted</span>
                  )}
                </p>
              )}
            </div>
          </div>
          {/* If the user is a PICKER or DRIVER (here because they have admin features),
              show a link back to their primary dashboard. */}
          {userRole && (userRole.toUpperCase() === 'PICKER' || userRole.toUpperCase() === 'DRIVER') && (
            <Link
              href={userRole.toUpperCase() === 'PICKER' ? '/picker' : '/driver'}
              className="flex items-center gap-2 mb-2 px-3 py-2 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to {userRole.toUpperCase() === 'PICKER' ? 'Picker' : 'Driver'} Dashboard
            </Link>
          )}
          <div className="flex gap-2">
            <Link href="/account/profile" className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <UserCircle className="h-3 w-3 mr-1" />
                Profile
              </Button>
            </Link>
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
      <div className="lg:pl-64 flex-1 min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2 px-3 h-14">
            {/* Mobile hamburger — on the LEFT because the sidebar slides in from the left.
                Putting it on the right (where it used to be) feels disjointed: the trigger
                and the panel it opens are on opposite sides of the screen. */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 flex-shrink-0 order-first" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] sm:max-w-[280px] p-0 flex flex-col h-screen">
                <SheetHeader className="px-6 h-16 flex flex-row items-center gap-2 border-b border-gray-200 p-0 mx-0 mb-0 flex-shrink-0">
                  <div className="flex items-center gap-2 px-6 w-full h-16">
                    <StoreLogo size={32} />
                    <div>
                      <SheetTitle className="font-bold text-gray-900 text-sm leading-tight">{storeName} Admin</SheetTitle>
                      <SheetDescription className="text-xs text-gray-500 leading-tight">Store Management</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                {/* Fresh gradient strip under the logo */}
                <div className="fm-sidebar-strip flex-shrink-0" aria-hidden="true" />

                {/* Navigation — scrollable when content overflows the sheet height */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden min-h-0">
                  {visibleNavItems.map((item) => {
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
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {isActive && <ChevronRight className="h-4 w-4 ml-auto flex-shrink-0" />}
                      </Link>
                    )
                  })}
                </nav>

                {/* User Info & Actions — pinned at the bottom, never scrolled away */}
                <div className="border-t border-gray-200 p-4 flex-shrink-0">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-5 w-5 text-[#16a34a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                      {userRole && (
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">
                          {userRole}
                          {enabledFeatures !== null && enabledFeatures !== undefined && (
                            <span className="ml-1 text-amber-600">· Restricted</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* If the user is a PICKER or DRIVER, show a link back to their primary dashboard. */}
                  {userRole && (userRole.toUpperCase() === 'PICKER' || userRole.toUpperCase() === 'DRIVER') && (
                    <Link
                      href={userRole.toUpperCase() === 'PICKER' ? '/picker' : '/driver'}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium transition-colors min-h-[44px]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to {userRole.toUpperCase() === 'PICKER' ? 'Picker' : 'Driver'} Dashboard
                    </Link>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <Link href="/account/profile" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full min-h-[44px]">
                        <UserCircle className="h-4 w-4 mr-1" />
                        Profile
                      </Button>
                    </Link>
                    <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full min-h-[44px]">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Store
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        handleLogout()
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo + page title — sits to the right of the hamburger */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <StoreLogo size={28} />
              <span className="font-bold text-sm text-gray-900 flex-shrink-0">Admin</span>
              <Separator orientation="vertical" className="h-5 mx-1 flex-shrink-0" />
              <span className="text-sm text-gray-600 truncate">{getPageTitle(pathname)}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
