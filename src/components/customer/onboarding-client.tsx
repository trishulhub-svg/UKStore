'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ArrowRight,
} from 'lucide-react'

const slides = [
  {
    emoji: '🛒',
    title: 'Browse Fresh Products',
    description: 'Explore thousands of fresh groceries, from fruits and vegetables to dairy, meat, and bakery items — all sourced locally.',
    color: 'bg-green-50',
    accentColor: 'bg-[#16a34a]',
  },
  {
    emoji: '✨',
    title: 'Place Your Order',
    description: 'Add items to your basket, choose a delivery slot, and checkout in seconds. We accept all major payment methods.',
    color: 'bg-orange-50',
    accentColor: 'bg-orange-500',
  },
  {
    emoji: '🚚',
    title: 'Track Your Delivery',
    description: 'Watch your order being picked, packed, and delivered in real time. Get updates every step of the way.',
    color: 'bg-blue-50',
    accentColor: 'bg-blue-500',
  },
]

export function OnboardingClient() {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const onboarded = localStorage.getItem('freshmart-onboarded')
    if (onboarded === 'true') {
      router.push('/')
    }
  }, [router])

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('freshmart-onboarded', 'true')
    router.push('/')
  }

  const handleGetStarted = () => {
    localStorage.setItem('freshmart-onboarded', 'true')
    router.push('/')
  }

  const slide = slides[currentSlide]

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        {currentSlide < slides.length - 1 && (
          <Button variant="ghost" onClick={handleSkip} className="text-gray-500 text-sm">
            Skip
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        {/* Illustration area */}
        <div className={`w-48 h-48 rounded-3xl ${slide.color} flex items-center justify-center mb-8`}>
          <span className="text-7xl">{slide.emoji}</span>
        </div>

        {/* Text */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
          {slide.title}
        </h2>
        <p className="text-gray-500 text-center leading-relaxed mb-8">
          {slide.description}
        </p>

        {/* Dots indicator */}
        <div className="flex items-center gap-2 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentSlide
                  ? `w-6 ${slide.accentColor}`
                  : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom action */}
      <div className="p-6 max-w-md mx-auto w-full">
        {currentSlide === slides.length - 1 ? (
          <Button
            onClick={handleGetStarted}
            className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-12 text-base font-semibold"
          >
            Get Started
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="flex-1 h-12"
            >
              Skip
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white h-12"
            >
              Next
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
