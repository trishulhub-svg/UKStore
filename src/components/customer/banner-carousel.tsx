'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel'
import type { Banner } from '@/types'

// Placeholder banners when no real banners exist
const PLACEHOLDER_BANNERS = [
  {
    id: 'placeholder-1',
    title: 'Fresh Groceries Delivered in 15 Minutes',
    image_url: '',
    link_url: '/catalog',
    gradient: 'from-[#16a34a] to-[#15803d]',
  },
  {
    id: 'placeholder-2',
    title: 'Free Delivery on Orders Over £20',
    image_url: '',
    link_url: '/catalog',
    gradient: 'from-[#f97316] to-[#ea580c]',
  },
  {
    id: 'placeholder-3',
    title: 'Fresh Fruits & Vegetables — Shop Now',
    image_url: '',
    link_url: '/catalog?category=fruits-vegetables',
    gradient: 'from-[#059669] to-[#047857]',
  },
  {
    id: 'placeholder-4',
    title: 'Dairy & Eggs — Farm Fresh Daily',
    image_url: '',
    link_url: '/catalog?category=dairy-eggs',
    gradient: 'from-[#2563eb] to-[#1d4ed8]',
  },
]

interface BannerCarouselProps {
  banners?: Banner[]
}

export function BannerCarousel({ banners: propBanners }: BannerCarouselProps) {
  const [fetchedBanners, setFetchedBanners] = useState<Banner[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [api, setApi] = useState<ReturnType<typeof Object> | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Use prop banners if provided, otherwise use fetched banners
  const banners = propBanners && propBanners.length > 0 ? propBanners : fetchedBanners

  // Fetch banners if not provided via props
  useEffect(() => {
    if (propBanners && propBanners.length > 0) return

    let cancelled = false
    fetch('/api/banners')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.banners && data.banners.length > 0) {
          setFetchedBanners(data.banners)
        }
      })
      .catch(() => {
        // Will use placeholders
      })
    return () => { cancelled = true }
  }, [propBanners])

  const displayBanners = banners.length > 0 ? banners : PLACEHOLDER_BANNERS
  const isPlaceholder = banners.length === 0

  // Auto-rotate
  useEffect(() => {
    if (isPaused || displayBanners.length <= 1) return

    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % displayBanners.length)
    }, 3000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPaused, displayBanners.length])

  // Sync api scroll with active index
  useEffect(() => {
    if (!api) return
    ;(api as any).scrollTo(activeIndex)
  }, [activeIndex, api])

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <Carousel
        setApi={(emblaApi) => {
          setApi(emblaApi as unknown as typeof api)
        }}
        opts={{
          loop: true,
          align: 'start',
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {displayBanners.map((banner, index) => (
            <CarouselItem key={banner.id} className="pl-0 basis-full">
              <Link
                href={banner.link_url || '#'}
                className="block w-full"
              >
                {isPlaceholder ? (
                  // Placeholder: gradient background with text
                  <div
                    className={`relative w-full h-40 sm:h-48 md:h-56 lg:h-64 bg-gradient-to-r ${(banner as typeof PLACEHOLDER_BANNERS[number]).gradient} flex items-center justify-center overflow-hidden rounded-xl`}
                  >
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="relative z-10 text-center px-6">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                        {banner.title}
                      </h2>
                      <p className="mt-2 text-sm text-white/80">Tap to shop now</p>
                    </div>
                  </div>
                ) : (
                  // Real banner: image with optional overlay
                  <div className="relative w-full h-40 sm:h-48 md:h-56 lg:h-64 overflow-hidden rounded-xl bg-gray-100">
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.title || 'Banner'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-[#16a34a] to-[#15803d] flex items-center justify-center">
                        <h2 className="text-xl font-bold text-white">{banner.title}</h2>
                      </div>
                    )}
                    {banner.title && banner.image_url && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <h2 className="text-lg sm:text-xl font-bold text-white drop-shadow-md">{banner.title}</h2>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Navigation arrows - visible on desktop */}
        <CarouselPrevious className="hidden md:flex left-3 bg-white/80 hover:bg-white border-0 shadow-md" />
        <CarouselNext className="hidden md:flex right-3 bg-white/80 hover:bg-white border-0 shadow-md" />
      </Carousel>

      {/* Dots Indicator */}
      {displayBanners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {displayBanners.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'w-6 bg-[#16a34a]'
                  : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
