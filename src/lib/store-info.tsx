'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface StoreInfo {
  id: string
  name: string
  slug: string
  address: string
  latitude: number
  longitude: number
  phone: string | null
  email: string | null
  logoUrl: string | null
  base_delivery_fee: number
  per_km_charge: number
  free_delivery_threshold: number
  delivery_radius_km: number
  is_active: boolean
  is_open: boolean
}

interface StoreInfoContextType {
  store: StoreInfo | null
  loading: boolean
  refresh: () => void
}

const StoreInfoContext = createContext<StoreInfoContextType>({
  store: null,
  loading: true,
  refresh: () => {},
})

export function useStoreInfo() {
  return useContext(StoreInfoContext)
}

export function StoreInfoProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStore = async () => {
    try {
      const res = await fetch('/api/store/info')
      if (res.ok) {
        const data = await res.json()
        setStore(data)
      }
    } catch {
      // Store info unavailable — components will use fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStore()
  }, [])

  return (
    <StoreInfoContext.Provider value={{ store, loading, refresh: fetchStore }}>
      {children}
    </StoreInfoContext.Provider>
  )
}
