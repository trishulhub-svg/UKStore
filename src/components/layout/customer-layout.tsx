'use client'

import Link from 'next/link'
import { ShoppingCart, Store, User, LogOut, Menu, X, LogIn, UserPlus, Shield, Truck as TruckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { useEffect, useState } from 'react'
import { authGetSession, authLogout, type AuthUser } from '@/lib/auth-client'
import { AuthModal } from '@/components/auth/auth-modal'
import { isAdminRole, isDriverRole } from '@/lib/auth'

interface CustomerLayoutProps {
  children: React.ReactNode
  storeName?: string
}

export function CustomerLayout({ children, storeName = 'Fresh Mart London' }: CustomerLayoutProps) {
  const getTotalItems = useCartStore((state) => state.getTotalItems)
  const [itemCount, setItemCount] = useState(0)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalView, setAuthModalView] = useState<'login' | 'register'>('login')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setItemCount(getTotalItems())
  }, [getTotalItems])

  // Subscribe to cart changes
  useEffect(() => {
    const unsub = useCartStore.subscribe(() => {
      setItemCount(useCartStore.getState().getTotalItems())
    })
    return unsub
  }, [])

  // Check auth state on mount
  useEffect(() => {
    authGetSession().then(({ user }) => {
      setUser(user)
    })
  }, [])

  const handleLogout = async () => {
    await authLogout()
    setUser(null)
    setMobileMenuOpen(false)
    window.location.href = '/'
  }

  const openLogin = () => {
    setAuthModalView('login')
    setAuthModalOpen(true)
    setMobileMenuOpen(false)
  }

  const openRegister = () => {
    setAuthModalView('register')
    setAuthModalOpen(true)
    setMobileMenuOpen(false)
  }

  const userFirstName = user?.name?.split(' ')[0] || null

  const isStaffAdmin = user ? isAdminRole(user.role) : false
  const isStaffDriver = user ? isDriverRole(user.role) : false

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Store Name */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Store className="h-6 w-6 text-[#16a34a]" />
              <span className="font-bold text-lg text-gray-900">{storeName}</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-medium text-gray-600 hover:text-[#16a34a] transition-colors"
              >
                Home
              </Link>
              <Link
                href="/catalog"
                className="text-sm font-medium text-gray-600 hover:text-[#16a34a] transition-colors"
              >
                Shop All
              </Link>
              {user && !isStaffAdmin && !isStaffDriver && (
                <Link
                  href="/account"
                  className="text-sm font-medium text-gray-600 hover:text-[#16a34a] transition-colors"
                >
                  Account
                </Link>
              )}
              {isStaffAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-[#16a34a] hover:text-[#15803d] transition-colors flex items-center gap-1.5"
                >
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </Link>
              )}
              {isStaffDriver && (
                <Link
                  href="/driver"
                  className="text-sm font-medium text-[#16a34a] hover:text-[#15803d] transition-colors flex items-center gap-1.5"
                >
                  <TruckIcon className="h-4 w-4" />
                  Driver Panel
                </Link>
              )}
            </nav>

            {/* Desktop Action Buttons */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <>
                  {isStaffAdmin ? (
                    <Link href="/admin" className="flex items-center gap-2 text-sm font-medium text-[#16a34a] hover:text-[#15803d] transition-colors px-3 py-1.5 rounded-lg hover:bg-green-50">
                      <Shield className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  ) : isStaffDriver ? (
                    <Link href="/driver" className="flex items-center gap-2 text-sm font-medium text-[#16a34a] hover:text-[#15803d] transition-colors px-3 py-1.5 rounded-lg hover:bg-green-50">
                      <TruckIcon className="h-4 w-4" />
                      <span>Driver Panel</span>
                    </Link>
                  ) : (
                    <Link href="/account" className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#16a34a] transition-colors px-3 py-1.5 rounded-lg hover:bg-green-50">
                      <User className="h-4 w-4" />
                      <span>{userFirstName || 'Account'}</span>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openLogin}
                    className="border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white font-semibold transition-colors"
                  >
                    <LogIn className="h-4 w-4 mr-1.5" />
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    onClick={openRegister}
                    className="bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Register
                  </Button>
                </>
              )}
              <Link href="/cart" className="relative">
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#f97316] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </Button>
              </Link>
            </div>

            {/* Mobile: Cart + Hamburger */}
            <div className="flex md:hidden items-center gap-1">
              <Link href="/cart" className="relative">
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#f97316] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white shadow-lg">
            <div className="px-4 py-3 space-y-1">
              {/* Nav Links */}
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors"
              >
                Home
              </Link>
              <Link
                href="/catalog"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors"
              >
                Shop All
              </Link>
              {user && !isStaffAdmin && !isStaffDriver && (
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors"
                >
                  My Account
                </Link>
              )}
              {isStaffAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </Link>
              )}
              {isStaffDriver && (
                <Link
                  href="/driver"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <TruckIcon className="h-4 w-4" />
                  Driver Panel
                </Link>
              )}

              {/* Divider */}
              <div className="border-t border-gray-100 my-2" />

              {/* Auth Section */}
              {user ? (
                <div className="space-y-1">
                  <div className="px-3 py-2 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#16a34a]/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-[#16a34a]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{userFirstName || 'User'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  {isStaffAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full text-left px-3 py-2.5 text-sm font-medium text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      Admin Panel
                    </Link>
                  )}
                  {isStaffDriver && (
                    <Link
                      href="/driver"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full text-left px-3 py-2.5 text-sm font-medium text-[#16a34a] hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <TruckIcon className="h-4 w-4" />
                      Driver Panel
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <Button
                    onClick={openLogin}
                    className="w-full border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a] hover:text-white font-semibold transition-colors"
                    variant="outline"
                  >
                    <LogIn className="h-4 w-4 mr-1.5" />
                    Sign In
                  </Button>
                  <Button
                    onClick={openRegister}
                    className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold"
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Create Account
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h3 className="font-semibold text-white mb-3">Fresh Mart London</h3>
              <p className="text-sm">Your local grocery delivery service. Fresh produce, delivered fast.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-3">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/catalog" className="hover:text-white transition-colors">Shop All</Link></li>
                <li><Link href="/catalog?category=fruits-vegetables" className="hover:text-white transition-colors">Fruits & Veg</Link></li>
                <li><Link href="/catalog?category=dairy-eggs" className="hover:text-white transition-colors">Dairy & Eggs</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-3">Customer Service</h3>
              <ul className="space-y-2 text-sm">
                <li><span>Delivery Info</span></li>
                <li><span>Returns Policy</span></li>
                <li><span>Contact Us</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-3">Contact</h3>
              <ul className="space-y-2 text-sm">
                <li>+44 20 1234 5678</li>
                <li>hello@freshmartlondon.co.uk</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-6 pt-6 text-center text-sm">
            <p>&copy; 2025 Fresh Mart London. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialView={authModalView}
      />
    </div>
  )
}
