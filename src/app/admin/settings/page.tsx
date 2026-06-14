import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { AdminSettingsClient } from '@/components/admin/admin-settings-client'
import type { StoreSetting, Store, DeliveryZone } from '@/types'

export const dynamic = 'force-dynamic'

const STORE_ID = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'

export default async function AdminSettingsPage() {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin/settings')
  }

  const supabase = getSupabaseAdmin()

  // Fetch settings from Supabase
  let settings: StoreSetting[] = []
  try {
    const { data: dbSettings, error: dbError } = await supabase
      .from('store_settings')
      .select('*')
      .eq('store_id', STORE_ID)

    if (dbError) {
      console.warn('[Admin Settings Page] Failed to fetch settings:', dbError)
    } else {
      settings = (dbSettings || []).map((s: any) => ({
        id: s.id,
        store_id: s.store_id,
        key: s.key,
        value: s.value,
        is_secret: s.is_secret,
        category: s.category as StoreSetting['category'],
        description: s.description,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }))
    }
  } catch (err) {
    console.warn('[Admin Settings Page] Failed to fetch settings:', err)
  }

  // Fetch store information
  let store: Store | null = null
  try {
    const { data: dbStore, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', STORE_ID)
      .single()

    if (storeError) {
      console.warn('[Admin Settings Page] Failed to fetch store:', storeError)
    } else if (dbStore) {
      store = {
        id: dbStore.id,
        name: dbStore.name || '',
        slug: dbStore.slug || '',
        address: dbStore.address || '',
        latitude: dbStore.latitude ?? 0,
        longitude: dbStore.longitude ?? 0,
        phone: dbStore.phone ?? null,
        email: dbStore.email ?? null,
        base_delivery_fee: dbStore.base_delivery_fee ?? 0,
        per_km_charge: dbStore.per_km_charge ?? 0,
        free_delivery_threshold: dbStore.free_delivery_threshold ?? 0,
        delivery_radius_km: dbStore.delivery_radius_km ?? 0,
        is_active: dbStore.is_active ?? true,
        created_at: dbStore.created_at ?? '',
        updated_at: dbStore.updated_at ?? '',
      }
    }
  } catch (err) {
    console.warn('[Admin Settings Page] Failed to fetch store:', err)
  }

  // Fetch delivery zones
  let deliveryZones: DeliveryZone[] = []
  try {
    const { data: dbZones, error: zonesError } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('store_id', STORE_ID)
      .order('name', { ascending: true })

    if (zonesError) {
      console.warn('[Admin Settings Page] Failed to fetch delivery zones:', zonesError)
    } else if (dbZones) {
      deliveryZones = dbZones.map((z: any) => ({
        id: z.id,
        store_id: z.store_id,
        name: z.name,
        postcodes: z.postcodes || '[]',
        delivery_fee: z.delivery_fee ?? 0,
        minimum_order: z.minimum_order ?? 0,
        is_active: z.is_active ?? true,
        created_at: z.created_at ?? '',
      }))
    }
  } catch (err) {
    console.warn('[Admin Settings Page] Failed to fetch delivery zones:', err)
  }

  // Fetch VAT stats from products
  let vatStats: {
    standardCount: number
    reducedCount: number
    zeroCount: number
    hfssCount: number
  } = { standardCount: 0, reducedCount: 0, zeroCount: 0, hfssCount: 0 }

  try {
    // Get counts grouped by vat_rate
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('vat_rate, is_hfss')
      .eq('store_id', STORE_ID)

    if (productsError) {
      console.warn('[Admin Settings Page] Failed to fetch products for VAT stats:', productsError)
    } else if (products) {
      for (const p of products) {
        const rate = Number(p.vat_rate)
        if (rate === 0.2) {
          vatStats.standardCount++
        } else if (rate === 0.05) {
          vatStats.reducedCount++
        } else {
          vatStats.zeroCount++
        }
        if (p.is_hfss) {
          vatStats.hfssCount++
        }
      }
    }
  } catch (err) {
    console.warn('[Admin Settings Page] Failed to fetch VAT stats:', err)
  }

  return (
    <AdminSettingsClient
      settings={settings}
      store={store}
      deliveryZones={deliveryZones}
      vatStats={vatStats}
      userId={user.id}
    />
  )
}
