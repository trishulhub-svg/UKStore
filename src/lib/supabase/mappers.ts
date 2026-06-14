/**
 * Mapping utilities to convert Supabase snake_case rows
 * to the camelCase shapes expected by admin frontend components.
 */

// ─── Generic snake_case → camelCase ────────────────────────

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Recursively converts all keys in an object from snake_case to camelCase.
 * Skips null/undefined values and preserves arrays.
 */
export function snakeToCamel<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj as T
  if (Array.isArray(obj)) return obj.map(snakeToCamel) as T
  if (typeof obj !== 'object') return obj as T

  const result: Record<string, any> = {}
  for (const key of Object.keys(obj)) {
    const camelKey = toCamelCase(key)
    result[camelKey] = snakeToCamel(obj[key])
  }
  return result as T
}

// ─── Order Mappers ─────────────────────────────────────────

export interface OrderItemCamel {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  vatRate: number
  vatAmount: number
  subtotal: number
  picked: boolean
}

export interface OrderCamel {
  id: string
  status: string
  subtotal: number
  vatAmount: number
  deliveryFee: number
  total: number
  paymentStatus: string
  notes: string | null
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string; email: string; phone?: string } | null
  driver: { id: string; name: string } | null
  items: OrderItemCamel[]
  address?: any
}

export function mapOrder(raw: any): OrderCamel {
  return {
    id: raw.id,
    status: raw.status,
    subtotal: Number(raw.subtotal) || 0,
    vatAmount: Number(raw.vat_amount) || 0,
    deliveryFee: Number(raw.delivery_fee) || 0,
    total: Number(raw.total) || 0,
    paymentStatus: raw.payment_status || 'pending',
    notes: raw.notes || null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    customer: raw.customer
      ? { id: raw.customer.id, name: raw.customer.full_name, email: raw.customer.email, phone: raw.customer.phone }
      : null,
    driver: raw.driver
      ? { id: raw.driver.id, name: raw.driver.full_name }
      : null,
    items: (raw.items || []).map(mapOrderItem),
    address: raw.address ? snakeToCamel(raw.address) : undefined,
  }
}

export function mapOrderItem(raw: any): OrderItemCamel {
  return {
    id: raw.id,
    productName: raw.product_name,
    quantity: raw.quantity,
    unitPrice: Number(raw.unit_price) || 0,
    vatRate: Number(raw.vat_rate) || 0,
    vatAmount: Number(raw.vat_amount) || 0,
    subtotal: Number(raw.subtotal) || 0,
    picked: raw.picked || false,
  }
}

// ─── Customer Mappers ──────────────────────────────────────

export interface CustomerCamel {
  id: string
  name: string | null
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  orderCount: number
  totalSpent: number
  orders: Array<{
    id: string
    total: number
    status: string
    createdAt: string
  }>
}

export function mapCustomer(raw: any): CustomerCamel {
  const orders = raw.orders || []
  const orderCount = orders.length
  const totalSpent = orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)

  return {
    id: raw.id,
    name: raw.full_name,
    email: raw.email,
    phone: raw.phone || null,
    isActive: raw.is_active ?? true,
    createdAt: raw.created_at,
    orderCount,
    totalSpent,
    orders: orders.map((o: any) => ({
      id: o.id,
      total: Number(o.total) || 0,
      status: o.status,
      createdAt: o.created_at,
    })),
  }
}

// ─── Driver Mappers ────────────────────────────────────────

export interface DriverCamel {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  driverProfile: {
    id: string
    vehicleType: string | null
    verificationStatus: string
    isOnDuty: boolean
    rejectionReason: string | null
    verifiedAt: string | null
  } | null
  orderCount: number
}

export function mapDriver(raw: any): DriverCamel {
  const dp = raw.driverProfile?.[0] || raw.driverProfile || raw.driver_profile?.[0] || raw.driver_profile || null
  const orderCount = raw.drivenOrders?.length || raw._count?.drivenOrders || 0

  return {
    id: raw.id,
    name: raw.full_name,
    email: raw.email,
    phone: raw.phone || null,
    isActive: raw.is_active ?? true,
    createdAt: raw.created_at,
    driverProfile: dp ? {
      id: dp.id,
      vehicleType: dp.vehicle_type,
      verificationStatus: dp.verification_status,
      isOnDuty: dp.is_on_duty ?? false,
      rejectionReason: dp.rejection_reason,
      verifiedAt: dp.verified_at,
    } : null,
    orderCount,
  }
}

// ─── Promotion Mappers ─────────────────────────────────────

export interface PromotionCamel {
  id: string
  name: string
  description: string | null
  discountType: string
  discountValue: number
  startDate: string
  endDate: string
  appliesToCategoryIds: string | null
  excludesHfss: boolean
  isActive: boolean
  code: string | null
  createdAt: string
}

export function mapPromotion(raw: any): PromotionCamel {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || null,
    discountType: raw.discount_type,
    discountValue: Number(raw.discount_value) || 0,
    startDate: raw.start_date,
    endDate: raw.end_date,
    appliesToCategoryIds: raw.applies_to_category_ids || null,
    excludesHfss: raw.excludes_hfss || false,
    isActive: raw.is_active ?? true,
    code: raw.code || null,
    createdAt: raw.created_at,
  }
}
