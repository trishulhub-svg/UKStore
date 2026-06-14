'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, ArrowRight } from 'lucide-react'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/vat'

/**
 * FloatingBasketBar — Fixed green bar at the bottom of mobile screens
 * when the cart has items. Shows item count, total price, and a
 * "View Basket" link. Animated slide-up when items are added.
 * Hidden on /cart page to avoid redundancy.
 */
export function FloatingBasketBar() {
  const pathname = usePathname()
  const getTotalItems = useCartStore((state) => state.getTotalItems)
  const getTotalPrice = useCartStore((state) => state.getTotalPrice)
  const [itemCount, setItemCount] = useState(0)
  const [totalPrice, setTotalPrice] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  // Subscribe to cart changes reactively
  useEffect(() => {
    const updateCounts = () => {
      const count = useCartStore.getState().getTotalItems()
      const price = useCartStore.getState().getTotalPrice()
      setItemCount(count)
      setTotalPrice(price)
      setIsVisible(count > 0)
    }

    // Initial read
    updateCounts()

    // Subscribe to subsequent changes
    const unsub = useCartStore.subscribe(updateCounts)
    return unsub
  }, [])

  // Don't show on /cart page
  if (pathname === '/cart') return null

  // Don't show if no items
  if (!isVisible || itemCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div
        className="mx-3 mb-3 rounded-2xl shadow-lg transition-transform duration-300 ease-out"
        style={{
          backgroundColor: '#16a34a',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        <Link
          href="/cart"
          className="flex items-center justify-between px-5 py-4 text-white no-underline"
        >
          {/* Left: Item count + total */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 flex-shrink-0" />
              <span className="font-semibold text-sm whitespace-nowrap">
                {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            <span className="text-white/60 text-sm">•</span>
            <span className="font-bold text-base">
              {formatPrice(totalPrice)}
            </span>
          </div>

          {/* Right: View Basket CTA */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-4">
            <span className="font-semibold text-sm">View Basket</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      </div>
    </div>
  )
}
