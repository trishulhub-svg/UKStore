'use client'

import { Footer } from '@/components/layout/footer'
import { Navbar } from '@/components/layout/navbar'
import { CartSidebar } from '@/components/customer/cart-sidebar'
import { FloatingBasketBar } from '@/components/customer/floating-basket-bar'
import type { Store } from '@/types'

interface CustomerLayoutProps {
  children: React.ReactNode
  storeName?: string
  store?: Store | null
}

export function CustomerLayout({ children, storeName, store }: CustomerLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col fm-gradient-bg">
      {/* Enhanced Navbar with search, delivery timer, cart widget */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Full Footer - How it Works, Categories Grid, App Download, Social */}
      <Footer />

      {/* Slide-Out Cart Sidebar — uses real store data when available */}
      <CartSidebar store={store ?? null} />

      {/* Floating Basket Bar — mobile only, visible across all customer pages */}
      <FloatingBasketBar />
    </div>
  )
}
