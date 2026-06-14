'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// ─── Dynamic Leaflet Import (SSR-safe) ────────────────────────

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)

interface CustomerMapProps {
  storeLat: number
  storeLng: number
  driverLat?: number | null
  driverLng?: number | null
  driverName?: string | null
  deliveryLat?: number | null
  deliveryLng?: number | null
  deliveryAddress?: string
}

export function CustomerTrackingMap({
  storeLat,
  storeLng,
  driverLat,
  driverLng,
  driverName,
  deliveryLat,
  deliveryLng,
  deliveryAddress,
}: CustomerMapProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [L, setL] = useState<typeof import('leaflet') | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    import('leaflet').then((leaflet) => {
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      setL(leaflet)
      setLeafletLoaded(true)
    })
  }, [])

  if (!mounted || !leafletLoaded) {
    return (
      <div className="h-[250px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Loading map...</div>
      </div>
    )
  }

  const centerLat = driverLat || deliveryLat || storeLat
  const centerLng = driverLng || deliveryLng || storeLng

  // Store icon
  const storeIcon = L!.divIcon({
    html: `<div style="background:#16a34a;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  // Driver icon
  const driverIcon = L!.divIcon({
    html: `<div style="background:#f97316;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);animation:pulse 2s infinite"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  // Delivery destination icon
  const destIcon = L!.divIcon({
    html: `<div style="background:#3b82f6;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

  return (
    <div className="h-[250px] rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        zoomControl={true}
        dragging={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Store marker */}
        <Marker position={[storeLat, storeLng]} icon={storeIcon}>
          <Popup>
            <div className="text-center">
              <p className="font-bold text-sm">Fresh Mart Store</p>
            </div>
          </Popup>
        </Marker>

        {/* Delivery destination */}
        {deliveryLat && deliveryLng && (
          <Marker position={[deliveryLat, deliveryLng]} icon={destIcon}>
            <Popup>
              <div>
                <p className="font-medium text-sm">Your Location</p>
                {deliveryAddress && <p className="text-xs text-gray-500">{deliveryAddress}</p>}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Driver location */}
        {driverLat && driverLng && (
          <Marker position={[driverLat, driverLng]} icon={driverIcon}>
            <Popup>
              <div>
                <p className="font-medium text-sm">{driverName || 'Your Driver'}</p>
                <p className="text-xs text-[#16a34a]">On the way to you!</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
