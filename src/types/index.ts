// ============================================================
// UK Grocery Store - TypeScript Types
// Aligned with Supabase database schema
// ============================================================

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
  vat_rate: number;
  is_hfss: boolean;
  image_url: string | null;
  barcode: string | null;
  unit: string;
  weight_kg: number | null;
  is_available: boolean;
  stock_quantity: number;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface ProductWithCategory extends Product {
  category: Category;
}

export interface CartItem {
  product: Product;
  quantity: number;
  substitute_preference: 'closest_match' | 'do_not_substitute';
}

export interface Profile {
  id: string;
  store_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'customer' | 'owner' | 'manager' | 'picker' | 'rider';
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
  picker_id: string | null;
  rider_id: string | null;
  address_id: string;
  status: 'placed' | 'picking' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  subtotal: number;
  vat_amount: number;
  delivery_fee: number;
  total: number;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
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
  substitute_preference: 'closest_match' | 'do_not_substitute' | null;
  substituted_with: string | null;
  picked: boolean;
}

export interface StoreSetting {
  id: string;
  store_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  category: 'integrations' | 'delivery' | 'notifications' | 'general';
  description: string | null;
  last_updated_by: string | null;
  created_at: string;
  updated_at: string;
}

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
