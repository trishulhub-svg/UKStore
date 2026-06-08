'use client'

import Link from 'next/link'
import { ShoppingCart, Store, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { useEffect, useState } from 'react'

interface CustomerLayoutProps {
  children: React.ReactNode
  storeName?: string
}

export function CustomerLayout({ children, storeName = 'Fresh Mart London' }: CustomerLayoutProps) {
  const getTotalItems = useCartStore((state) => state.getTotalItems)
  const [itemCount, setItemCount] = useState(0)

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

            {/* Navigation */}
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
              <Link
                href="/account"
                className="text-sm font-medium text-gray-600 hover:text-[#16a34a] transition-colors"
              >
                Account
              </Link>
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <Link href="/account" className="hidden md:block">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
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
          </div>
        </div>
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
    </div>
  )
}
