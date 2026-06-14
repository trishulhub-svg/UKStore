'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Loader2, Package, Truck, Navigation } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import dynamic from 'next/dynamic'

// ─── Types ────────────────────────────────────────────────────

interface StoreInfo {
  latitude: number
  longitude: number
  deliveryRadiusKm: number
  name: string
  address: string
}

interface MapOrder {
  id: string
  status: string
  total: number
  customerName: string
  address: {
    id: string
    addressLine1: string
    postcode: string
    latitude: number | null
    longitude: number | null
  }
  driver: { id: string; name: string } | null
}

interface MapDriver {
  id: string
  name: string
  vehicleType: string | null
  vehicleReg: string | null
  activeOrderId: string | null
  latitude: number
  longitude: number
}

// ─── Dynamic Leaflet Import (SSR-safe) ────────────────────────

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
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

// ─── Order Detail Popup ──────────────────────────────────────

function OrderPopup({ order }: { order: MapOrder }) {
  const statusColours: Record<string, string> = {
    placed: 'bg-blue-100 text-blue-700',
    picking: 'bg-amber-100 text-amber-700',
    ready: 'bg-purple-100 text-purple-700',
    out_for_delivery: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="min-w-[180px]">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-gray-500">#{order.id.slice(-6).toUpperCase()}</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColours[order.status] || ''}`}>
          {order.status.replace(/_/g, ' ')}
        </Badge>
      </div>
      <p className="text-sm font-medium">{order.customerName}</p>
      <p className="text-xs text-gray-500">{order.address.addressLine1}</p>
      <p className="text-xs text-gray-500">{order.address.postcode}</p>
      <p className="text-sm font-bold mt-1">£{order.total.toFixed(2)}</p>
      {order.driver && (
        <p className="text-xs text-gray-500 mt-1">Driver: {order.driver.name}</p>
      )}
    </div>
  )
}

// ─── Map Inner (must be client-side only) ─────────────────────

function DeliveryMapInner({
  store,
  orders,
  drivers,
}: {
  store: StoreInfo
  orders: MapOrder[]
  drivers: MapDriver[]
}) {
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      // Fix default marker icon issue in webpack
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

  if (!leafletLoaded) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-100 rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // Custom store icon
  const storeIcon = L!.divIcon({
    html: `<div style="background:#16a34a;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

  // Custom driver icon
  const driverIcon = L!.divIcon({
    html: `<div style="background:#f97316;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  // Custom order icon
  const orderIcon = L!.divIcon({
    html: `<div style="background:#3b82f6;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

  const ordersWithCoords = orders.filter((o) => o.address.latitude && o.address.longitude)

  return (
    <div className="h-[400px] lg:h-[500px] rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={[store.latitude, store.longitude]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Delivery Radius Circle */}
        <Circle
          center={[store.latitude, store.longitude]}
          radius={store.deliveryRadiusKm * 1000}
          pathOptions={{
            color: '#16a34a',
            fillColor: '#16a34a',
            fillOpacity: 0.08,
            weight: 2,
            dashArray: '8, 8',
          }}
        />

        {/* Store Marker */}
        <Marker position={[store.latitude, store.longitude]} icon={storeIcon}>
          <Popup>
            <div className="text-center">
              <p className="font-bold text-sm">{store.name}</p>
              <p className="text-xs text-gray-500">{store.address}</p>
              <p className="text-xs text-[#16a34a] mt-1">Delivery radius: {store.deliveryRadiusKm}km</p>
            </div>
          </Popup>
        </Marker>

        {/* Order Markers */}
        {ordersWithCoords.map((order) => (
          <Marker
            key={order.id}
            position={[order.address.latitude!, order.address.longitude!]}
            icon={orderIcon}
          >
            <Popup>
              <OrderPopup order={order} />
            </Popup>
          </Marker>
        ))}

        {/* Driver Markers */}
        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            position={[driver.latitude, driver.longitude]}
            icon={driverIcon}
          >
            <Popup>
              <div>
                <p className="font-bold text-sm">{driver.name}</p>
                {driver.vehicleType && (
                  <p className="text-xs text-gray-500 capitalize">{driver.vehicleType}</p>
                )}
                {driver.vehicleReg && (
                  <p className="text-xs font-mono text-gray-500 uppercase">{driver.vehicleReg}</p>
                )}
                {driver.activeOrderId && (
                  <p className="text-xs text-orange-600 mt-1">On delivery: #{driver.activeOrderId.slice(-6).toUpperCase()}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export function DeliveryMap() {
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [orders, setOrders] = useState<MapOrder[]>([])
  const [drivers, setDrivers] = useState<MapDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/delivery-map')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setStore(data.store)
      setOrders(data.orders || [])
      setDrivers(data.drivers || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading || !mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-gray-600" />
            Delivery Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] bg-gray-100 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!store) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-gray-600" />
            Delivery Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] bg-gray-50 rounded-lg text-gray-400">
            Store location not configured
          </div>
        </CardContent>
      </Card>
    )
  }

  const statusCounts = {
    placed: orders.filter((o) => o.status === 'placed').length,
    picking: orders.filter((o) => o.status === 'picking').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    out_for_delivery: orders.filter((o) => o.status === 'out_for_delivery').length,
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-gray-600" />
            Delivery Map
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              <Package className="h-3 w-3 mr-1" />
              {statusCounts.placed + statusCounts.picking + statusCounts.ready} Active
            </Badge>
            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
              <Truck className="h-3 w-3 mr-1" />
              {statusCounts.out_for_delivery} Delivering
            </Badge>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              <Navigation className="h-3 w-3 mr-1" />
              {drivers.length} Driver{drivers.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DeliveryMapInner store={store} orders={orders} drivers={drivers} />

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#16a34a]" />
            <span>Store</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Orders</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Drivers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-dashed border-[#16a34a]" />
            <span>{store.deliveryRadiusKm}km radius</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
