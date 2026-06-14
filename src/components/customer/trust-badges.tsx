'use client'

import { ShieldCheck, Truck, Leaf } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const badges = [
  {
    icon: ShieldCheck,
    label: 'Easy Refunds',
    description: 'Hassle-free refunds within 24 hours',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
  },
  {
    icon: Truck,
    label: 'Fast Delivery',
    description: '10-minute delivery in your area',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-100',
  },
  {
    icon: Leaf,
    label: 'Fresh Guarantee',
    description: 'Fresh produce or your money back',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
  },
]

export function TrustBadges() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-3">
        {badges.map((badge) => (
          <Tooltip key={badge.label}>
            <TooltipTrigger asChild>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-full border ${badge.borderColor} ${badge.bgColor} cursor-default transition-transform hover:scale-105`}
              >
                <badge.icon className={`h-4 w-4 ${badge.color}`} />
                <span className={`text-xs font-medium ${badge.color}`}>{badge.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {badge.description}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
