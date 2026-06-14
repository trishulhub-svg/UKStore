'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Heart,
  ShoppingCart,
  Trash2,
  ArrowLeft,
  Package,
} from 'lucide-react'
import { useCartStore } from '@/stores/cart-store'
import type { Product } from '@/types'

interface Favourite {
  id: string
  productId: string
  createdAt: string
  product: {
    id: string
    name: string
    slug: string
    price: number
    imageUrl: string | null
    isAvailable: boolean
    stockQuantity: number
    category: { name: string; slug: string } | null
  }
}

export function FavouritesClient() {
  const router = useRouter()
  const [favourites, setFavourites] = useState<Favourite[]>([])
  const [loading, setLoading] = useState(true)
  const addItem = useCartStore((state) => state.addItem)

  const fetchFavourites = async () => {
    try {
      const res = await fetch('/api/user/favourites')
      if (res.ok) {
        const data = await res.json()
        setFavourites(data.favourites || [])
      }
    } catch (err) {
      console.error('Failed to fetch favourites:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFavourites()
  }, [])

  const handleRemove = async (productId: string) => {
    try {
      const res = await fetch(`/api/user/favourites?productId=${productId}`, { method: 'DELETE' })
      if (res.ok) {
        setFavourites((prev) => prev.filter((f) => f.productId !== productId))
      }
    } catch (err) {
      console.error('Failed to remove favourite:', err)
    }
  }

  const handleAddToCart = (favourite: Favourite) => {
    const product: Product = {
      id: favourite.product.id,
      store_id: '',
      category_id: '',
      name: favourite.product.name,
      slug: favourite.product.slug,
      description: null,
      price: favourite.product.price,
      vat_rate: 0,
      is_hfss: false,
      image_url: favourite.product.imageUrl,
      barcode: null,
      unit: 'each',
      weight_kg: null,
      is_available: favourite.product.isAvailable,
      stock_quantity: favourite.product.stockQuantity,
      is_featured: false,
      sort_order: 0,
      created_at: '',
      updated_at: '',
      category: favourite.product.category
        ? { id: '', store_id: '', name: favourite.product.category.name, slug: favourite.product.category.slug, description: null, image_url: null, parent_id: null, sort_order: 0, is_active: true, created_at: '' }
        : undefined,
    }
    addItem(product)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-48" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Favourites</h1>
          <p className="text-sm text-gray-500">{favourites.length} saved item{favourites.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {favourites.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Heart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600">No favourite items yet</p>
            <p className="text-sm text-gray-400 mt-1">Tap the heart icon on products to save them here</p>
            <Link href="/catalog">
              <Button className="mt-4 bg-[#16a34a] hover:bg-[#15803d] text-white">
                Browse Products
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {favourites.map((favourite) => (
            <Card key={favourite.id} className="shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-3">
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                  {favourite.product.imageUrl ? (
                    <img
                      src={favourite.product.imageUrl}
                      alt={favourite.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-gray-300" />
                  )}
                </div>

                {/* Product Info */}
                <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                  {favourite.product.name}
                </p>
                {favourite.product.category && (
                  <p className="text-xs text-gray-400 mt-0.5">{favourite.product.category.name}</p>
                )}
                <p className="text-sm font-bold text-[#16a34a] mt-1">
                  £{favourite.product.price.toFixed(2)}
                </p>

                {!favourite.product.isAvailable && (
                  <Badge variant="secondary" className="text-[10px] mt-1 bg-red-100 text-red-700">
                    Unavailable
                  </Badge>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 mt-2">
                  <Button
                    size="sm"
                    onClick={() => handleAddToCart(favourite)}
                    disabled={!favourite.product.isAvailable}
                    className="flex-1 h-8 text-xs bg-[#16a34a] hover:bg-[#15803d] text-white"
                  >
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(favourite.productId)}
                    className="h-8 w-8 text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
