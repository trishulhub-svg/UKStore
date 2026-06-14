'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/vat'

const PLACEHOLDER_SUGGESTIONS = [
  'Semi-Skimmed Milk',
  'Crisps',
  'Cheddar Cheese',
  'Bread',
  'Eggs',
]

interface SearchResult {
  id: string
  name: string
  slug: string
  price: number
  original_price: number | null
  image_url: string | null
  brand: string | null
  rating: number
  review_count: number
  category: { id: string; name: string; slug: string } | null
}

export function PredictiveSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState('')
  const [isTypingPlaceholder, setIsTypingPlaceholder] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Animated placeholder typing effect
  useEffect(() => {
    if (query) {
      setIsTypingPlaceholder(false)
      return
    }

    setIsTypingPlaceholder(true)
    const currentSuggestion = PLACEHOLDER_SUGGESTIONS[placeholderIndex]
    let charIndex = 0
    let isDeleting = false

    const interval = setInterval(() => {
      if (!isDeleting) {
        charIndex++
        setDisplayedPlaceholder(currentSuggestion.slice(0, charIndex))
        if (charIndex === currentSuggestion.length) {
          isDeleting = true
          // Pause before deleting
          setTimeout(() => {}, 1500)
        }
      } else {
        charIndex--
        setDisplayedPlaceholder(currentSuggestion.slice(0, charIndex))
        if (charIndex === 0) {
          isDeleting = false
          setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length)
        }
      }
    }, 80)

    return () => clearInterval(interval)
  }, [query, placeholderIndex])

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsOpen(false)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery.trim())}`)
      const data = await res.json()
      setResults(data.products || [])
      setIsOpen(true)
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounce input changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query.trim()) {
      setResults([])
      setIsOpen(false)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, performSearch])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      router.push(`/catalog?q=${encodeURIComponent(trimmed)}`)
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  const handleInputChange = (value: string) => {
    setQuery(value)
  }

  const clearQuery = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          placeholder={isTypingPlaceholder && !query ? `Search "${displayedPlaceholder}"` : 'Search groceries...'}
          className="h-10 pl-9 pr-9 text-sm rounded-lg border-gray-200 bg-gray-50 focus:bg-white focus:border-[#16a34a] focus:ring-[#16a34a]/20 transition-colors"
          aria-label="Search groceries"
          autoComplete="off"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
        {!isSearching && query && (
          <button
            type="button"
            onClick={clearQuery}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-gray-400" />
          </button>
        )}
      </form>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
              onClick={() => {
                setIsOpen(false)
                setQuery('')
              }}
            >
              {/* Product Image */}
              <div className="w-10 h-10 rounded-md bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">🛒</span>
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <div className="flex items-center gap-2">
                  {product.brand && (
                    <span className="text-[10px] text-gray-400">{product.brand}</span>
                  )}
                  {product.category && (
                    <span className="text-[10px] text-gray-400">{product.category.name}</span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-gray-900">{formatPrice(product.price)}</p>
                {product.original_price && product.original_price > product.price && (
                  <p className="text-[10px] text-gray-400 line-through">{formatPrice(product.original_price)}</p>
                )}
              </div>
            </Link>
          ))}

          {/* View All Results */}
          <Link
            href={`/catalog?q=${encodeURIComponent(query)}`}
            className="block px-3 py-2.5 text-center text-sm font-medium text-[#16a34a] hover:bg-green-50 transition-colors border-t"
            onClick={() => {
              setIsOpen(false)
            }}
          >
            View all results for &quot;{query}&quot;
          </Link>
        </div>
      )}

      {/* No Results */}
      {isOpen && query.trim() && !isSearching && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden z-50 p-4 text-center">
          <p className="text-sm text-gray-500">No products found for &quot;{query}&quot;</p>
          <Link
            href={`/catalog?q=${encodeURIComponent(query)}`}
            className="text-sm text-[#16a34a] hover:underline mt-1 inline-block"
            onClick={() => setIsOpen(false)}
          >
            Browse all products
          </Link>
        </div>
      )}
    </div>
  )
}
