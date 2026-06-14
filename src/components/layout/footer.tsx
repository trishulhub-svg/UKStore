'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Leaf, ShoppingBag, ShoppingCart, Truck, Instagram, Linkedin, MapPin, Phone, Mail } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useStoreInfo } from '@/lib/store-info'

interface FooterCategory {
  id: string
  name: string
  slug: string
}

// Fallback categories if API fails
const fallbackCategories: { name: string; slug: string }[] = [
  { name: 'Fruits & Vegetables', slug: 'fruits-vegetables' },
  { name: 'Dairy & Eggs', slug: 'dairy-eggs' },
  { name: 'Meat & Fish', slug: 'meat-fish' },
  { name: 'Bakery', slug: 'bakery' },
  { name: 'Frozen Foods', slug: 'frozen' },
  { name: 'Drinks & Beverages', slug: 'drinks' },
  { name: 'Pantry Essentials', slug: 'pantry' },
  { name: 'Snacks & Sweets', slug: 'snacks-sweets' },
]

const howItWorksSteps = [
  {
    icon: ShoppingBag,
    title: 'Browse Products',
    description: 'Open the app and explore thousands of items',
  },
  {
    icon: ShoppingCart,
    title: 'Place Your Order',
    description: 'Add items to cart and checkout in minutes',
  },
  {
    icon: Truck,
    title: 'Get Fast Delivery',
    description: 'Lightning-fast delivery straight to your door',
  },
]

const companyLinks = [
  { label: 'Home', href: '/' },
  { label: 'Delivery Areas', href: '/catalog' },
  { label: 'Careers', href: '#' },
  { label: 'Customer Support', href: '#' },
  { label: 'Blog', href: '#' },
]

const legalLinks = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Use', href: '#' },
  { label: 'Careers', href: '#' },
  { label: 'Franchise', href: '#' },
]

// X (Twitter) icon as simple SVG since lucide doesn't have the new X logo
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// Facebook icon
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

export function Footer() {
  const [categories, setCategories] = useState<FooterCategory[]>([])
  const { store: storeInfo } = useStoreInfo()
  const storeName = storeInfo?.name || 'Fresh Mart'

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(data.categories)
        }
      })
      .catch(() => {
        // Use fallback categories
      })
  }, [])

  const displayCategories = categories.length > 0
    ? categories.map((c) => ({ name: c.name, slug: c.slug }))
    : fallbackCategories

  // Split categories into 5 columns
  const totalCats = displayCategories.length
  const cols = 5
  const perCol = Math.ceil(totalCats / cols)
  const categoryColumns: { name: string; slug: string }[][] = []
  for (let i = 0; i < cols; i++) {
    categoryColumns.push(displayCategories.slice(i * perCol, (i + 1) * perCol))
  }

  return (
    <footer className="bg-[#1a1a2e] text-gray-300">
      {/* How It Works Section */}
      <div className="border-b border-gray-700/50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 className="text-center text-lg font-semibold text-white mb-8">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {howItWorksSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={step.title}
                  className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-14 h-14 rounded-full bg-[#16a34a]/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7 text-[#16a34a]" />
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#16a34a] text-white text-xs font-bold">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500">{step.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Categories Sitemap */}
      <div className="border-b border-gray-700/50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h2 className="text-center text-lg font-semibold text-white mb-6">Shop by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-6 gap-y-3">
            {categoryColumns.map((column, colIdx) => (
              <div key={colIdx} className="space-y-2">
                {column.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/catalog?category=${cat.slug}`}
                    className="block text-sm text-gray-400 hover:text-[#16a34a] transition-colors truncate"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Corporate & App Links */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <Leaf className="size-5 text-[#16a34a]" />
              <span className="text-lg font-bold text-[#16a34a]">{storeName}</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your local grocery delivery service, bringing fresh produce and
              everyday essentials straight to your door.
            </p>
            {/* Contact Details */}
            {storeInfo && (
              <div className="space-y-2 pt-1">
                {storeInfo.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-[#16a34a] mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-400">{storeInfo.address}</span>
                  </div>
                )}
                {storeInfo.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#16a34a] flex-shrink-0" />
                    <a href={`tel:${storeInfo.phone}`} className="text-sm text-gray-400 hover:text-[#16a34a] transition-colors">{storeInfo.phone}</a>
                  </div>
                )}
                {storeInfo.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#16a34a] flex-shrink-0" />
                    <a href={`mailto:${storeInfo.email}`} className="text-sm text-gray-400 hover:text-[#16a34a] transition-colors">{storeInfo.email}</a>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-700/50 flex items-center justify-center hover:bg-[#16a34a] transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-700/50 flex items-center justify-center hover:bg-[#16a34a] transition-colors"
                aria-label="X (Twitter)"
              >
                <XIcon className="h-4 w-4" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-700/50 flex items-center justify-center hover:bg-[#16a34a] transition-colors"
                aria-label="Facebook"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-gray-700/50 flex items-center justify-center hover:bg-[#16a34a] transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
            <p className="text-xs text-gray-500">
              &copy; {new Date().getFullYear()} {storeName}. All rights reserved.
            </p>
          </div>

          {/* Column 2: Company Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Company</h3>
            <ul className="space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-[#16a34a] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Legal & Business */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Legal & Business</h3>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-[#16a34a] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Download App */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Get the App</h3>
            <div className="space-y-3">
              {/* Google Play Badge Placeholder */}
              <button
                type="button"
                className="flex items-center gap-3 w-full bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded-lg px-4 py-2.5 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-300 shrink-0" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.396 13l2.302-2.492zM5.864 3.457L16.8 9.79l-2.302 2.302-8.634-8.635z" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] text-gray-400 leading-none">GET IT ON</p>
                  <p className="text-sm text-white font-medium leading-tight">Google Play</p>
                </div>
              </button>

              {/* App Store Badge Placeholder */}
              <button
                type="button"
                className="flex items-center gap-3 w-full bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded-lg px-4 py-2.5 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-300 shrink-0" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="text-left">
                  <p className="text-[10px] text-gray-400 leading-none">DOWNLOAD ON THE</p>
                  <p className="text-sm text-white font-medium leading-tight">App Store</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700/50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              VAT Registered &middot; UK Food Standards Compliant
            </p>
            <p className="text-xs text-gray-500">
              Made with <span className="text-[#16a34a]">&hearts;</span> in {storeInfo?.address?.split(',').pop()?.trim() || 'London'}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
