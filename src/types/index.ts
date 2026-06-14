// ============================================================
// UK Grocery Store - TypeScript Types
// Aligned with Supabase database schema (snake_case)
// and Prisma models (camelCase with mapping)
// ============================================================

// ─── Enums ────────────────────────────────────────────────────

export type Role = 'CUSTOMER' | 'DRIVER' | 'PICKER' | 'OWNER' | 'MANAGER'

/** @deprecated Legacy role type for backward compatibility */
export type LegacyRole = 'customer' | 'driver' | 'picker' | 'owner' | 'manager'

export type OrderStatus = 'placed' | 'picking' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export type SettingCategory = 'integrations' | 'delivery' | 'notifications' | 'general'

export type DiscountType = 'percentage' | 'fixed_amount'

/** VAT rate type — 0%, 5%, or 20% (UK) */
export type VatRate = 0 | 0.05 | 0.2

/** Substitute preference for cart items */
export type SubstitutePreference = 'closest_match' | 'do_not_substitute'

/** @deprecated Use Role instead */
export type UserRole = Role | LegacyRole

// ─── Core Models (snake_case for frontend compatibility) ──────

export interface Store {
  id: string;
  name: string;
  slug: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  base_delivery_fee: number;
  per_km_charge: number;
  free_delivery_threshold: number;
  delivery_radius_km: number;
  is_active: boolean;
  is_open: boolean;
  opening_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  original_price: number | null;
  vat_rate: number;
  is_hfss: boolean;
  image_url: string | null;
  images: string[] | null;
  barcode: string | null;
  brand: string | null;
  unit: string;
  weight_kg: number | null;
  is_available: boolean;
  stock_quantity: number;
  is_featured: boolean;
  rating: number;
  review_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface ProductWithCategory extends Product {
  category: Category;
}

export interface CartItem {
  product_id: string;
  product: Product;
  quantity: number;
  substitute_preference: SubstitutePreference;
}

export interface Profile {
  id: string;
  store_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role | LegacyRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  store_id: string;
  customer_id: string;
  driver_id: string | null;
  address_id: string;
  status: OrderStatus;
  subtotal: number;
  vat_amount: number;
  delivery_fee: number;
  total: number;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_status: PaymentStatus;
  delivery_slot: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  subtotal: number;
  substitute_preference: string | null;
  substituted_with: string | null;
  picked: boolean;
}

export interface StoreSetting {
  id: string;
  store_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  category: SettingCategory;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Favourite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface DriverProfile {
  id: string;
  user_id: string;
  vehicle_type: string | null;
  vehicle_reg: string | null;
  national_insurance_number: string | null;
  right_to_work_url: string | null;
  driving_license_url: string | null;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPricing {
  base_fee: number;
  per_km_charge: number;
  free_delivery_threshold: number;
  distance_km: number;
  delivery_fee: number;
  is_free_delivery: boolean;
}

export interface DeliveryZone {
  id: string;
  store_id: string;
  name: string;
  postcodes: string;  // JSON array of postcode strings
  delivery_fee: number;
  minimum_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Promotion {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  start_date: string;
  end_date: string;
  applies_to_category_ids: string | null;  // JSON array of category IDs
  excludes_hfss: boolean;
  is_active: boolean;
  code: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Auth Types ───────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authProvider?: 'local';
  createdAt?: string;
}

// ─── Setting Definitions ──────────────────────────────────────

/**
 * Known setting keys with their metadata.
 * Used to render the admin settings UI with proper labels and grouping.
 */
export const SETTING_DEFINITIONS: Record<string, {
  label: string;
  category: StoreSetting['category'];
  is_secret: boolean;
  description: string;
  placeholder: string;
}> = {
  stripe_publishable_key: {
    label: 'Stripe Publishable Key',
    category: 'integrations',
    is_secret: false,
    description: 'Used on the client side to initialise Stripe.js. Starts with pk_test_ or pk_live_.',
    placeholder: 'pk_test_...',
  },
  stripe_secret_key: {
    label: 'Stripe Secret Key',
    category: 'integrations',
    is_secret: true,
    description: 'Server-side key for creating checkout sessions and handling webhooks. Starts with sk_test_ or sk_live_.',
    placeholder: 'sk_test_...',
  },
  stripe_webhook_secret: {
    label: 'Stripe Webhook Secret',
    category: 'integrations',
    is_secret: true,
    description: 'Signing secret to verify incoming Stripe webhook events. Starts with whsec_.',
    placeholder: 'whsec_...',
  },
  google_oauth_client_id: {
    label: 'Google OAuth Client ID',
    category: 'integrations',
    is_secret: false,
    description: 'Google Cloud Console OAuth 2.0 Client ID for Sign in with Google.',
    placeholder: 'xxxx.apps.googleusercontent.com',
  },
  google_oauth_client_secret: {
    label: 'Google OAuth Client Secret',
    category: 'integrations',
    is_secret: true,
    description: 'Google Cloud Console OAuth 2.0 Client Secret. Keep this confidential.',
    placeholder: 'GOCSPX-...',
  },
  sendgrid_api_key: {
    label: 'SendGrid API Key',
    category: 'notifications',
    is_secret: true,
    description: 'SendGrid API key for sending transactional emails (order confirmations, password resets).',
    placeholder: 'SG.xxxx...',
  },
  taxjar_api_key: {
    label: 'TaxJar API Key',
    category: 'integrations',
    is_secret: true,
    description: 'TaxJar API key for automated tax calculation (optional — UK VAT is calculated locally by default).',
    placeholder: 'xxxx...',
  },
};

// ─── New Types for Requirements ────────────────────────────────

export interface AttendanceLog {
  id: string;
  user_id: string;
  type: 'clock_in' | 'clock_out';
  ip_address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Shift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface WastageLog {
  id: string;
  product_id: string;
  quantity: number;
  reason: 'expired' | 'damaged' | 'spoiled' | 'other';
  notes: string | null;
  logged_by: string;
  created_at: string;
  product?: Product;
}

export interface Expense {
  id: string;
  store_id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt_url: string | null;
  created_at: string;
}

export interface BankHoliday {
  id: string;
  store_id: string;
  name: string;
  date: string;
  mode: 'auto_close' | 'reduced_hours' | 'normal';
  created_at: string;
}

export interface Banner {
  id: string;
  store_id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  link_category: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeProfile {
  id: string;
  user_id: string;
  salary: number | null;
  wage_rate: number | null;
  wage_type: 'monthly' | 'hourly' | 'daily' | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_sort_code: string | null;
  created_at: string;
  updated_at: string;
}
