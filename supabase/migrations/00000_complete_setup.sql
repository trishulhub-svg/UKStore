-- ============================================================
-- Fresh Mart London - COMPLETE DATABASE SETUP
-- Run this entire script in Supabase SQL Editor to set up
-- everything in one go (schema + RLS + auth + seed data)
-- ============================================================

-- ── MIGRATION 1: Initial Schema ──

-- ============================================================
-- UK Grocery Store - Initial Database Schema
-- Supabase PostgreSQL + PostGIS
-- Per Backend Schema Document (Section 5)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For product search trigram index

-- ============================================================
-- TABLE: stores
-- ============================================================
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ) STORED,
    phone VARCHAR(20),
    email VARCHAR(255),
    base_delivery_fee DECIMAL(10, 2) DEFAULT 3.50,
    per_km_charge DECIMAL(10, 2) DEFAULT 0.50,
    free_delivery_threshold DECIMAL(10, 2) DEFAULT 20.00,
    delivery_radius_km DECIMAL(5, 2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- GiST index for geospatial queries (radius-based store lookup)
CREATE INDEX idx_stores_location ON stores USING GIST (location);

-- ============================================================
-- TABLE: profiles
-- Linked to Supabase Auth users
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'owner', 'manager', 'picker', 'rider')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick role lookups
CREATE INDEX idx_profiles_store ON profiles (store_id);
CREATE INDEX idx_profiles_role ON profiles (store_id, role);

-- ============================================================
-- TABLE: categories
-- Supports nested categories via parent_id
-- ============================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique slug per store
CREATE UNIQUE INDEX idx_categories_slug ON categories (store_id, slug);
CREATE INDEX idx_categories_parent ON categories (store_id, parent_id);

-- ============================================================
-- TABLE: products
-- Includes HFSS flag, VAT rate, and stock tracking
-- ============================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    vat_rate DECIMAL(5, 4) NOT NULL CHECK (vat_rate IN (0.0000, 0.0500, 0.2000)),
    is_hfss BOOLEAN DEFAULT false,
    image_url TEXT,
    barcode VARCHAR(50),
    unit VARCHAR(20) DEFAULT 'each',
    weight_kg DECIMAL(8, 3),
    is_available BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique slug per store
CREATE UNIQUE INDEX idx_products_slug ON products (store_id, slug);

-- B-tree for category browsing per store
CREATE INDEX idx_products_store_category ON products (store_id, category_id);

-- GIN trigram for full-text product search
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

-- B-tree for HFSS filtering in promotions
CREATE INDEX idx_products_hfss ON products (is_hfss, is_featured) WHERE is_available = true;

-- ============================================================
-- TABLE: addresses
-- Delivery addresses with PostGIS geocoding
-- ============================================================
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label VARCHAR(50),
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    postcode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        CASE
            WHEN latitude IS NOT NULL AND longitude IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
            ELSE NULL
        END
    ) STORED,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- GiST index for delivery zone validation
CREATE INDEX idx_addresses_location ON addresses USING GIST (location);
CREATE INDEX idx_addresses_user ON addresses (user_id);

-- ============================================================
-- TABLE: orders
-- Full order lifecycle tracking
-- ============================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES profiles(id),
    picker_id UUID REFERENCES profiles(id),
    rider_id UUID REFERENCES profiles(id),
    address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('placed', 'picking', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
    subtotal DECIMAL(10, 2) NOT NULL,
    vat_amount DECIMAL(10, 2) NOT NULL,
    delivery_fee DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    delivery_slot TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- B-tree for customer order history
CREATE INDEX idx_orders_customer ON orders (customer_id, created_at DESC);
-- B-tree for admin order management
CREATE INDEX idx_orders_store_status ON orders (store_id, status);
-- B-tree for rider delivery queue
CREATE INDEX idx_orders_rider ON orders (rider_id, status) WHERE rider_id IS NOT NULL;

-- ============================================================
-- TABLE: order_items
-- Line items with substitute tracking
-- ============================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    vat_rate DECIMAL(5, 4) NOT NULL,
    vat_amount DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    substitute_preference VARCHAR(20) CHECK (substitute_preference IN ('closest_match', 'do_not_substitute')),
    substituted_with UUID REFERENCES products(id),
    picked BOOLEAN DEFAULT false
);

-- B-tree for order detail retrieval
CREATE INDEX idx_order_items_order ON order_items (order_id);

-- ============================================================
-- TABLE: rider_verifications
-- Right-to-work document verification
-- ============================================================
CREATE TABLE rider_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('passport', 'driving_license', 'visa', 'national_id')),
    document_url TEXT NOT NULL,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rider_verifications_rider ON rider_verifications (rider_id);
CREATE INDEX idx_rider_verifications_status ON rider_verifications (verification_status);

-- ============================================================
-- HELPER: Function to update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- HELPER: Function to get user role (for RLS policies)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- HELPER: Function to get user's store_id (for RLS policies)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID AS $$
    SELECT store_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── MIGRATION 2: RLS Policies ──

-- ============================================================
-- UK Grocery Store - Row Level Security Policies
-- Per Backend Schema Document (Section 5.4)
-- Every table enforces RLS scoped to user roles
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_verifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STORES: RLS Policies
-- ============================================================

-- Owner: Full access to own store only
CREATE POLICY "Owner can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'owner');

-- Manager: View own store
CREATE POLICY "Manager can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'manager');

-- Customer: View active stores only
CREATE POLICY "Customers can view active stores" ON stores
    FOR SELECT TO authenticated
    USING (is_active = true AND get_user_role() = 'customer');

-- Picker/Rider: View own store
CREATE POLICY "Staff can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() IN ('picker', 'rider'));

-- Owner: Update own store
CREATE POLICY "Owner can update own store" ON stores
    FOR UPDATE TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (id = get_user_store_id() AND get_user_role() = 'owner');

-- Owner: Insert (for new store creation)
CREATE POLICY "Owner can insert store" ON stores
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() = 'owner');

-- ============================================================
-- PROFILES: RLS Policies
-- ============================================================

-- Owner: View all staff in own store
CREATE POLICY "Owner can view own store profiles" ON profiles
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner');

-- Manager: View all staff in own store
CREATE POLICY "Manager can view own store profiles" ON profiles
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Customer: View own profile only
CREATE POLICY "Customers can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() AND get_user_role() = 'customer');

-- Picker/Rider: View own profile only
CREATE POLICY "Staff can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() AND get_user_role() IN ('picker', 'rider'));

-- All users: Insert own profile (during signup)
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Owner: Update staff in own store
CREATE POLICY "Owner can update own store profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id());

-- Customer: Update own profile
CREATE POLICY "Customers can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() AND get_user_role() = 'customer')
    WITH CHECK (id = auth.uid());

-- Picker/Rider: Update own profile
CREATE POLICY "Staff can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() AND get_user_role() IN ('picker', 'rider'))
    WITH CHECK (id = auth.uid());

-- ============================================================
-- CATEGORIES: RLS Policies
-- ============================================================

-- Owner/Manager: Full CRUD on own store categories
CREATE POLICY "Owner can manage own store categories" ON categories
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');

CREATE POLICY "Manager can manage own store categories" ON categories
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Customer: View active categories only
CREATE POLICY "Customers can view active categories" ON categories
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Picker: View categories for picking
CREATE POLICY "Picker can view store categories" ON categories
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'picker');

-- ============================================================
-- PRODUCTS: RLS Policies
-- ============================================================

-- Owner/Manager: Full CRUD on own store products
CREATE POLICY "Owner can manage own store products" ON products
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');

CREATE POLICY "Manager can manage own store products" ON products
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Customer: View available products only
CREATE POLICY "Customers can view available products" ON products
    FOR SELECT TO authenticated
    USING (is_available = true);

-- Picker: View products for picking
CREATE POLICY "Picker can view store products" ON products
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'picker');

-- ============================================================
-- ADDRESSES: RLS Policies
-- ============================================================

-- Users: Full access to own addresses only
CREATE POLICY "Users can view own addresses" ON addresses
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own addresses" ON addresses
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own addresses" ON addresses
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own addresses" ON addresses
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Owner/Manager: View delivery addresses for own store orders
CREATE POLICY "Staff can view order addresses" ON addresses
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.address_id = addresses.id
            AND orders.store_id = get_user_store_id()
            AND get_user_role() IN ('owner', 'manager')
        )
    );

-- ============================================================
-- ORDERS: RLS Policies
-- ============================================================

-- Owner/Manager: View and update own store orders
CREATE POLICY "Owner can manage own store orders" ON orders
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner');

CREATE POLICY "Manager can view own store orders" ON orders
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager');

CREATE POLICY "Owner can update own store orders" ON orders
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Manager can update own store orders" ON orders
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id());

-- Customer: View and create own orders only
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT TO authenticated
    USING (customer_id = auth.uid() AND get_user_role() = 'customer');

CREATE POLICY "Customers can insert own orders" ON orders
    FOR INSERT TO authenticated
    WITH CHECK (customer_id = auth.uid() AND get_user_role() = 'customer');

-- Picker: View and update assigned orders
CREATE POLICY "Picker can view assigned orders" ON orders
    FOR SELECT TO authenticated
    USING (picker_id = auth.uid() AND get_user_role() = 'picker');

CREATE POLICY "Picker can update assigned orders" ON orders
    FOR UPDATE TO authenticated
    USING (picker_id = auth.uid() AND get_user_role() = 'picker')
    WITH CHECK (picker_id = auth.uid());

-- Rider: View and update assigned orders
CREATE POLICY "Rider can view assigned orders" ON orders
    FOR SELECT TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider');

CREATE POLICY "Rider can update assigned orders" ON orders
    FOR UPDATE TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider')
    WITH CHECK (rider_id = auth.uid());

-- ============================================================
-- ORDER_ITEMS: RLS Policies
-- ============================================================

-- Follow the same access pattern as orders
CREATE POLICY "Owner can view own store order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.store_id = get_user_store_id()
            AND get_user_role() = 'owner'
        )
    );

CREATE POLICY "Manager can view own store order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.store_id = get_user_store_id()
            AND get_user_role() = 'manager'
        )
    );

CREATE POLICY "Customers can view own order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.customer_id = auth.uid()
            AND get_user_role() = 'customer'
        )
    );

CREATE POLICY "Picker can view assigned order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.picker_id = auth.uid()
            AND get_user_role() = 'picker'
        )
    );

CREATE POLICY "Picker can update assigned order items" ON order_items
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.picker_id = auth.uid()
            AND get_user_role() = 'picker'
        )
    );

CREATE POLICY "Rider can view assigned order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.rider_id = auth.uid()
            AND get_user_role() = 'rider'
        )
    );

CREATE POLICY "Customers can insert order items" ON order_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.customer_id = auth.uid()
        )
    );

-- ============================================================
-- RIDER_VERIFICATIONS: RLS Policies
-- ============================================================

-- Owner/Manager: View and approve/reject own store rider verifications
CREATE POLICY "Owner can manage rider verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = rider_verifications.rider_id
            AND profiles.store_id = get_user_store_id()
            AND get_user_role() = 'owner'
        )
    );

CREATE POLICY "Manager can view rider verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = rider_verifications.rider_id
            AND profiles.store_id = get_user_store_id()
            AND get_user_role() = 'manager'
        )
    );

CREATE POLICY "Owner can update rider verifications" ON rider_verifications
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = rider_verifications.rider_id
            AND profiles.store_id = get_user_store_id()
            AND get_user_role() = 'owner'
        )
    );

-- Rider: View and upload own documents
CREATE POLICY "Rider can view own verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider');

CREATE POLICY "Rider can insert own verifications" ON rider_verifications
    FOR INSERT TO authenticated
    WITH CHECK (rider_id = auth.uid() AND get_user_role() = 'rider');

-- ── MIGRATION 3: Auth Trigger ──

-- ============================================================
-- UK Grocery Store - Auth Trigger
-- Auto-creates profile when new user signs up via Supabase Auth
-- ============================================================

-- Function to handle new user signup
-- Creates a profile row automatically when a user registers
-- IMPORTANT: If no active store exists, the profile insert is skipped
-- to avoid FK violation. The profile will be created when a store
-- is seeded and the user can be manually linked.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    -- Get the first active store as default (for single-store MVP)
    SELECT id INTO default_store_id FROM stores WHERE is_active = true LIMIT 1;

    -- Only insert profile if an active store exists
    -- Without a valid store_id, the FK constraint on profiles.store_id
    -- would reject the insert and roll back the entire auth.users INSERT,
    -- making registration silently fail with no error shown to the user.
    IF default_store_id IS NOT NULL THEN
        INSERT INTO profiles (id, store_id, email, full_name, role)
        VALUES (
            NEW.id,
            default_store_id,
            COALESCE(NEW.email, ''),
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Customer'),
            'customer'
        );
    ELSE
        -- No store exists yet — insert profile with NULL store_id
        -- This requires store_id to be nullable
        INSERT INTO profiles (id, store_id, email, full_name, role)
        VALUES (
            NEW.id,
            NULL,
            COALESCE(NEW.email, ''),
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Customer'),
            'customer'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: After insert on auth.users, create profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── MIGRATION 4: Store Settings ──

-- ============================================================
-- UK Grocery Store - Store Settings Table
-- Encrypted key-value store for API keys and configuration
-- Only accessible by owner/manager RBAC roles
-- ============================================================

-- Store settings table: key-value pairs with encryption support
CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,          -- encrypted value (AES-256 via pgcrypto)
    is_secret BOOLEAN NOT NULL DEFAULT true,  -- true = API key/secret, false = public config
    category TEXT NOT NULL DEFAULT 'integrations',  -- grouping: 'integrations', 'delivery', 'notifications', 'general'
    description TEXT,             -- human-readable description of what this key is for
    last_updated_by UUID REFERENCES auth.users(id),  -- audit: who last changed it
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Each store can only have one value per key
    UNIQUE(store_id, key)
);

-- Index for fast lookups
CREATE INDEX idx_store_settings_store_id ON store_settings(store_id);
CREATE INDEX idx_store_settings_category ON store_settings(store_id, category);

-- Enable Row Level Security
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only owner and manager roles can manage settings
-- Customers, pickers, riders cannot see or modify API keys

-- Owners can do everything
CREATE POLICY "Owners can view all settings"
    ON store_settings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.store_id = store_settings.store_id
            AND profiles.role = 'owner'
        )
    );

CREATE POLICY "Owners can insert settings"
    ON store_settings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.store_id = store_settings.store_id
            AND profiles.role = 'owner'
        )
    );

CREATE POLICY "Owners can update settings"
    ON store_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.store_id = store_settings.store_id
            AND profiles.role = 'owner'
        )
    );

CREATE POLICY "Owners can delete settings"
    ON store_settings FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.store_id = store_settings.store_id
            AND profiles.role = 'owner'
        )
    );

-- Managers can view and update (but not delete or add new keys)
CREATE POLICY "Managers can view settings"
    ON store_settings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.store_id = store_settings.store_id
            AND profiles.role = 'manager'
        )
    );

CREATE POLICY "Managers can update settings"
    ON store_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.store_id = store_settings.store_id
            AND profiles.role = 'manager'
        )
    );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_store_settings_updated_at
    BEFORE UPDATE ON store_settings
    FOR EACH ROW EXECUTE FUNCTION update_store_settings_updated_at();

-- ============================================================
-- Seed: Default settings entries (empty values, to be filled by owner)
-- ============================================================

INSERT INTO store_settings (store_id, key, value, is_secret, category, description) VALUES
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'stripe_publishable_key', '', true, 'integrations', 'Stripe Publishable Key (pk_test_... or pk_live_...)'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'stripe_secret_key', '', true, 'integrations', 'Stripe Secret Key (sk_test_... or sk_live_...)'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'stripe_webhook_secret', '', true, 'integrations', 'Stripe Webhook Signing Secret (whsec_...)'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'google_oauth_client_id', '', false, 'integrations', 'Google OAuth Client ID (for Sign in with Google)'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'google_oauth_client_secret', '', true, 'integrations', 'Google OAuth Client Secret'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'sendgrid_api_key', '', true, 'notifications', 'SendGrid API Key (for transactional emails)'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'taxjar_api_key', '', true, 'integrations', 'TaxJar API Key (for automated tax calculation, optional)')
ON CONFLICT (store_id, key) DO NOTHING;

-- ── MIGRATION 5: Nullable Store ID ──

-- ============================================================
-- Migration: Make profiles.store_id nullable
-- This allows user registration to succeed even when no store
-- exists yet. The auth trigger will insert a profile with
-- NULL store_id if no active store is found.
-- ============================================================

ALTER TABLE profiles ALTER COLUMN store_id DROP NOT NULL;

-- ── MIGRATION 6: Fix Auth Schema ──

-- ============================================================
-- Migration 00006: Fix Auth Schema for Registration & Login
-- This is a comprehensive fix-all script that ensures:
--   1. profiles.store_id is nullable (allows registration without a store)
--   2. Auth trigger exists and is correct (auto-creates profile on signup)
--   3. RLS policies don't deadlock new users (profile self-service)
--   4. Public read access for stores, categories, products (browse without login)
--   5. Helper functions exist (get_user_role, get_user_store_id)
--   6. All required extensions are enabled
--   7. Seed data exists (store, categories, products)
--
-- Run this ENTIRE script in Supabase SQL Editor.
-- All statements are idempotent (safe to re-run).
-- ============================================================

-- ============================================================
-- STEP 1: Enable required extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- STEP 2: Make profiles.store_id nullable
-- This is CRITICAL — without it, registration silently fails
-- when no store exists (FK violation rolls back auth.users INSERT)
-- ============================================================
ALTER TABLE profiles ALTER COLUMN store_id DROP NOT NULL;

-- ============================================================
-- STEP 3: Recreate helper functions (idempotent)
-- These are used by RLS policies
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID AS $$
    SELECT store_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 4: (Re)create the auth trigger function
-- Auto-creates a profile row when a new user signs up.
-- Handles the case where no active store exists yet.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    -- Get the first active store as default (for single-store MVP)
    SELECT id INTO default_store_id FROM stores WHERE is_active = true LIMIT 1;

    -- Insert profile with store_id if store exists, NULL otherwise
    INSERT INTO profiles (id, store_id, email, full_name, role)
    VALUES (
        NEW.id,
        default_store_id,  -- NULL if no store found (store_id is now nullable)
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Customer'),
        'customer'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to avoid duplication
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- STEP 5: Fix RLS policies for profiles
-- The original policies have a DEADLOCK: get_user_role() returns NULL
-- for a new user (no profile yet), so the user can't read their own
-- profile to create one. We fix this by adding a policy that allows
-- any authenticated user to INSERT their own profile (not just via trigger).
-- ============================================================

-- Drop existing profile policies that may cause deadlock
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Customers can view own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can view own profile" ON profiles;
DROP POLICY IF EXISTS "Customers can update own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can update own profile" ON profiles;
DROP POLICY IF EXISTS "Owner can view own store profiles" ON profiles;
DROP POLICY IF EXISTS "Manager can view own store profiles" ON profiles;
DROP POLICY IF EXISTS "Owner can update own store profiles" ON profiles;

-- Any authenticated user can insert their own profile (id = auth.uid())
-- This is essential for the auth trigger AND for manual profile creation
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Any authenticated user can view their own profile
-- (No dependency on get_user_role() — avoids deadlock)
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Any authenticated user can update their own profile
-- (No dependency on get_user_role() — avoids deadlock)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Owner: View all staff in own store
CREATE POLICY "Owner can view own store profiles" ON profiles
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner');

-- Manager: View all staff in own store
CREATE POLICY "Manager can view own store profiles" ON profiles
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Owner: Update staff in own store
CREATE POLICY "Owner can update own store profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id());

-- ============================================================
-- STEP 6: Add public read access for stores, categories, products
-- Without these, logged-out users can't browse the catalog
-- ============================================================

-- Stores: anyone (even anon) can view active stores
DROP POLICY IF EXISTS "Public can view active stores" ON stores;
CREATE POLICY "Public can view active stores" ON stores
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- Categories: anyone can view active categories
DROP POLICY IF EXISTS "Public can view active categories" ON categories;
CREATE POLICY "Public can view active categories" ON categories
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- Products: anyone can view available products
DROP POLICY IF EXISTS "Public can view available products" ON products;
CREATE POLICY "Public can view available products" ON products
    FOR SELECT TO anon, authenticated
    USING (is_available = true);

-- ============================================================
-- STEP 7: Ensure updated_at trigger exists on profiles
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STEP 8: Ensure seed store exists
-- ============================================================
INSERT INTO stores (id, name, slug, address, latitude, longitude, phone, email, base_delivery_fee, per_km_charge, free_delivery_threshold, delivery_radius_km)
VALUES (
    'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
    'Fresh Mart London',
    'fresh-mart-london',
    '123 High Street, Lewisham, London, SE13 6LG',
    51.46120,
    -0.01170,
    '+44 20 1234 5678',
    'hello@freshmartlondon.co.uk',
    3.50,
    0.50,
    20.00,
    5.00
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    is_active = true;

-- ============================================================
-- STEP 9: Ensure seed categories exist
-- ============================================================
INSERT INTO categories (id, store_id, name, slug, description, sort_order) VALUES
    ('b1a10000-0000-4a00-b000-000000000001', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Fruits & Vegetables', 'fruits-vegetables', 'Fresh produce delivered daily', 1),
    ('b1a10000-0000-4a00-b000-000000000002', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Dairy & Eggs', 'dairy-eggs', 'Milk, cheese, butter and eggs', 2),
    ('b1a10000-0000-4a00-b000-000000000003', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Meat & Fish', 'meat-fish', 'Fresh meat and fish counter', 3),
    ('b1a10000-0000-4a00-b000-000000000004', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Bakery', 'bakery', 'Freshly baked bread and pastries', 4),
    ('b1a10000-0000-4a00-b000-000000000005', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Pantry', 'pantry', 'Rice, pasta, sauces and more', 5),
    ('b1a10000-0000-4a00-b000-000000000006', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Drinks', 'drinks', 'Juices, water, soft drinks and tea', 6),
    ('b1a10000-0000-4a00-b000-000000000007', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Frozen', 'frozen', 'Frozen meals, ice cream and more', 7),
    ('b1a10000-0000-4a00-b000-000000000008', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Snacks & Sweets', 'snacks-sweets', 'Crisps, biscuits, chocolate and more', 8)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- ============================================================
-- STEP 10: Ensure seed products exist
-- ============================================================
INSERT INTO products (id, store_id, category_id, name, slug, description, price, vat_rate, is_hfss, unit, is_available, stock_quantity, is_featured) VALUES
    ('a1000000-0000-4a00-b000-000000000001', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'Organic Bananas', 'organic-bananas', 'Fairtrade organic bananas, pack of 6', 1.49, 0.0000, false, 'each', true, 150, true),
    ('a1000000-0000-4a00-b000-000000000002', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'Baby Spinach', 'baby-spinach', 'Fresh baby spinach leaves, 200g bag', 1.89, 0.0000, false, 'each', true, 80, false),
    ('a1000000-0000-4a00-b000-000000000003', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'British Strawberries', 'british-strawberries', 'Sweet British strawberries, 400g', 3.49, 0.0000, false, 'each', true, 45, true),
    ('a1000000-0000-4a00-b000-000000000004', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Free Range Eggs', 'free-range-eggs', 'Free range large eggs, pack of 12', 2.79, 0.0000, false, 'each', true, 100, true),
    ('a1000000-0000-4a00-b000-000000000005', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Semi-Skimmed Milk', 'semi-skimmed-milk', 'British semi-skimmed milk, 2 litres', 1.65, 0.0000, false, 'each', true, 200, false),
    ('a1000000-0000-4a00-b000-000000000006', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Mature Cheddar', 'mature-cheddar', 'Strong mature cheddar cheese, 400g', 3.29, 0.0000, false, 'each', true, 60, false),
    ('a1000000-0000-4a00-b000-000000000007', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000003', 'Chicken Breast', 'chicken-breast', 'Free range chicken breast fillets, 500g', 5.99, 0.0000, false, 'kg', true, 40, true),
    ('a1000000-0000-4a00-b000-000000000008', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000003', 'Scottish Salmon Fillet', 'scottish-salmon-fillet', 'Fresh Scottish salmon fillet, 200g', 6.49, 0.0000, false, 'each', true, 25, false),
    ('a1000000-0000-4a00-b000-000000000009', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000004', 'Sourdough Loaf', 'sourdough-loaf', 'Artisan sourdough bread, freshly baked', 3.49, 0.0000, false, 'each', true, 30, true),
    ('a1000000-0000-4a00-b000-000000000010', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000004', 'Croissants', 'croissants', 'Butter croissants, pack of 4', 2.29, 0.0000, false, 'each', true, 50, false),
    ('a1000000-0000-4a00-b000-000000000011', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Basmati Rice', 'basmati-rice', 'Premium basmati rice, 1kg', 2.99, 0.0000, false, 'each', true, 90, false),
    ('a1000000-0000-4a00-b000-000000000012', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Penne Pasta', 'penne-pasta', 'Italian penne pasta, 500g', 1.29, 0.0000, false, 'each', true, 120, false),
    ('a1000000-0000-4a00-b000-000000000013', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000006', 'Orange Juice', 'orange-juice', 'Freshly squeezed orange juice, 1L', 2.49, 0.0000, false, 'each', true, 75, true),
    ('a1000000-0000-4a00-b000-000000000014', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000006', 'Coca-Cola', 'coca-cola', 'Classic Coca-Cola, 1.5L bottle', 1.99, 0.2000, true, 'each', true, 100, false),
    ('a1000000-0000-4a00-b000-000000000015', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000007', 'Frozen Pizza', 'frozen-pizza', 'Stone baked margherita pizza', 3.49, 0.0000, true, 'each', true, 55, false),
    ('a1000000-0000-4a00-b000-000000000016', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Salt & Vinegar Crisps', 'salt-vinegar-crisps', 'Classic salt and vinegar crisps, 150g', 1.59, 0.2000, true, 'each', true, 80, false),
    ('a1000000-0000-4a00-b000-000000000017', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Dark Chocolate Bar', 'dark-chocolate-bar', '70% cocoa dark chocolate, 100g', 1.89, 0.0000, true, 'each', true, 60, false),
    ('a1000000-0000-4a00-b000-000000000018', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Mixed Nuts', 'mixed-nuts', 'Roasted and salted mixed nuts, 200g', 3.29, 0.0000, false, 'each', true, 40, false),
    ('a1000000-0000-4a00-b000-000000000019', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Greek Yogurt', 'greek-yogurt', 'Thick and creamy Greek yogurt, 500g', 2.49, 0.0000, false, 'each', true, 70, true),
    ('a1000000-0000-4a00-b000-000000000020', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Extra Virgin Olive Oil', 'extra-virgin-olive-oil', 'Italian extra virgin olive oil, 500ml', 5.99, 0.0000, false, 'each', true, 35, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    price = EXCLUDED.price,
    is_available = EXCLUDED.is_available,
    stock_quantity = EXCLUDED.stock_quantity,
    is_featured = EXCLUDED.is_featured;

-- ============================================================
-- STEP 11: Ensure store_settings table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    is_secret BOOLEAN NOT NULL DEFAULT true,
    category TEXT NOT NULL DEFAULT 'integrations',
    description TEXT,
    last_updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(store_id, key)
);

CREATE INDEX IF NOT EXISTS idx_store_settings_store_id ON store_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_store_settings_category ON store_settings(store_id, category);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Store settings RLS: Only owner/manager
DROP POLICY IF EXISTS "Owners can view all settings" ON store_settings;
DROP POLICY IF EXISTS "Owners can insert settings" ON store_settings;
DROP POLICY IF EXISTS "Owners can update settings" ON store_settings;
DROP POLICY IF EXISTS "Owners can delete settings" ON store_settings;
DROP POLICY IF EXISTS "Managers can view settings" ON store_settings;
DROP POLICY IF EXISTS "Managers can update settings" ON store_settings;

CREATE POLICY "Owners can view all settings" ON store_settings FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.store_id = store_settings.store_id AND profiles.role = 'owner'));
CREATE POLICY "Owners can insert settings" ON store_settings FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.store_id = store_settings.store_id AND profiles.role = 'owner'));
CREATE POLICY "Owners can update settings" ON store_settings FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.store_id = store_settings.store_id AND profiles.role = 'owner'));
CREATE POLICY "Owners can delete settings" ON store_settings FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.store_id = store_settings.store_id AND profiles.role = 'owner'));
CREATE POLICY "Managers can view settings" ON store_settings FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.store_id = store_settings.store_id AND profiles.role = 'manager'));
CREATE POLICY "Managers can update settings" ON store_settings FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.store_id = store_settings.store_id AND profiles.role = 'manager'));

-- Seed store settings (idempotent)
INSERT INTO store_settings (store_id, key, value, is_secret, category, description) VALUES
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'stripe_publishable_key', '', true, 'integrations', 'Stripe Publishable Key (pk_test_... or pk_live_...)'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'stripe_secret_key', '', true, 'integrations', 'Stripe Secret Key (sk_test_... or sk_live_...)'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'stripe_webhook_secret', '', true, 'integrations', 'Stripe Webhook Signing Secret (whsec_...)'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'google_oauth_client_id', '', false, 'integrations', 'Google OAuth Client ID'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'google_oauth_client_secret', '', true, 'integrations', 'Google OAuth Client Secret'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'sendgrid_api_key', '', true, 'notifications', 'SendGrid API Key'),
    ('a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'taxjar_api_key', '', true, 'integrations', 'TaxJar API Key')
ON CONFLICT (store_id, key) DO NOTHING;

-- ============================================================
-- STEP 12: Fix any existing profiles with NULL store_id
-- Link them to the default store if it exists
-- ============================================================
UPDATE profiles
SET store_id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'
WHERE store_id IS NULL
AND EXISTS (SELECT 1 FROM stores WHERE id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890');

-- ============================================================
-- VERIFICATION QUERIES (run these to verify everything is set up)
-- ============================================================
-- SELECT count(*) FROM stores;             -- should be >= 1
-- SELECT count(*) FROM categories;          -- should be 8
-- SELECT count(*) FROM products;            -- should be 20
-- SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';  -- should exist
-- SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';  -- should exist
-- SELECT polname FROM pg_policy WHERE tablename = 'profiles'::regclass;  -- should list policies

-- ── MIGRATION 7: Bootstrap Full Schema ──

-- ============================================================
-- UK STORE: Complete Database Bootstrap Script
-- Run this ENTIRE script in Supabase SQL Editor to set up
-- everything needed for user registration and login.
--
-- This script is idempotent (safe to re-run multiple times).
-- It creates tables if missing, fixes RLS, seeds data, etc.
-- ============================================================

-- ============================================================
-- STEP 1: Enable required extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- STEP 2: Create tables (IF NOT EXISTS for safety)
-- ============================================================

-- Stores table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ) STORED,
    phone VARCHAR(20),
    email VARCHAR(255),
    base_delivery_fee DECIMAL(10, 2) DEFAULT 3.50,
    per_km_charge DECIMAL(10, 2) DEFAULT 0.50,
    free_delivery_threshold DECIMAL(10, 2) DEFAULT 20.00,
    delivery_radius_km DECIMAL(5, 2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores USING GIST (location);

-- Profiles table (store_id is NULLABLE - critical for registration)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'owner', 'manager', 'picker', 'rider')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_store ON profiles (store_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (store_id, role);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories (store_id, slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (store_id, parent_id);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    vat_rate DECIMAL(5, 4) NOT NULL CHECK (vat_rate IN (0.0000, 0.0500, 0.2000)),
    is_hfss BOOLEAN DEFAULT false,
    image_url TEXT,
    barcode VARCHAR(50),
    unit VARCHAR(20) DEFAULT 'each',
    weight_kg DECIMAL(8, 3),
    is_available BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products (store_id, slug);
CREATE INDEX IF NOT EXISTS idx_products_store_category ON products (store_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_hfss ON products (is_hfss, is_featured) WHERE is_available = true;

-- Addresses table
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label VARCHAR(50),
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    postcode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        CASE
            WHEN latitude IS NOT NULL AND longitude IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
            ELSE NULL
        END
    ) STORED,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addresses_location ON addresses USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES profiles(id),
    picker_id UUID REFERENCES profiles(id),
    rider_id UUID REFERENCES profiles(id),
    address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'picking', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
    subtotal DECIMAL(10, 2) NOT NULL,
    vat_amount DECIMAL(10, 2) NOT NULL,
    delivery_fee DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    delivery_slot TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders (store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders (rider_id, status) WHERE rider_id IS NOT NULL;

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    vat_rate DECIMAL(5, 4) NOT NULL,
    vat_amount DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    substitute_preference VARCHAR(20) CHECK (substitute_preference IN ('closest_match', 'do_not_substitute')),
    substituted_with UUID REFERENCES products(id),
    picked BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- Rider verifications table
CREATE TABLE IF NOT EXISTS rider_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('passport', 'driving_license', 'visa', 'national_id')),
    document_url TEXT NOT NULL,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rider_verifications_rider ON rider_verifications (rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_verifications_status ON rider_verifications (verification_status);

-- ============================================================
-- STEP 3: Ensure profiles.store_id is nullable
-- THIS IS THE MOST CRITICAL FIX FOR REGISTRATION
-- ============================================================
ALTER TABLE profiles ALTER COLUMN store_id DROP NOT NULL;

-- ============================================================
-- STEP 4: Helper functions for RLS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID AS $$
    SELECT store_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- updated_at triggers
DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STEP 5: Auth trigger — auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    SELECT id INTO default_store_id FROM stores WHERE is_active = true LIMIT 1;

    INSERT INTO profiles (id, store_id, email, full_name, role)
    VALUES (
        NEW.id,
        default_store_id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Customer'),
        'customer'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- STEP 6: Enable RLS on all tables
-- ============================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_verifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 7: RLS Policies — Stores
-- ============================================================
DROP POLICY IF EXISTS "Public can view active stores" ON stores;
CREATE POLICY "Public can view active stores" ON stores
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Owner can view own store" ON stores;
CREATE POLICY "Owner can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'owner');

DROP POLICY IF EXISTS "Manager can view own store" ON stores;
CREATE POLICY "Manager can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'manager');

DROP POLICY IF EXISTS "Staff can view own store" ON stores;
CREATE POLICY "Staff can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() IN ('picker', 'rider'));

DROP POLICY IF EXISTS "Owner can update own store" ON stores;
CREATE POLICY "Owner can update own store" ON stores
    FOR UPDATE TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (id = get_user_store_id() AND get_user_role() = 'owner');

DROP POLICY IF EXISTS "Owner can insert store" ON stores;
CREATE POLICY "Owner can insert store" ON stores
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() = 'owner');

-- ============================================================
-- STEP 8: RLS Policies — Profiles (DEADLOCK-FIXED)
-- ============================================================
-- Drop ALL old policies to start fresh
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Customers can view own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can view own profile" ON profiles;
DROP POLICY IF EXISTS "Customers can update own profile" ON profiles;
DROP POLICY IF EXISTS "Staff can update own profile" ON profiles;
DROP POLICY IF EXISTS "Owner can view own store profiles" ON profiles;
DROP POLICY IF EXISTS "Manager can view own store profiles" ON profiles;
DROP POLICY IF EXISTS "Owner can update own store profiles" ON profiles;

-- NEW: Deadlock-free profile policies
-- These don't depend on get_user_role() for self-service operations
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admin profile access (requires role check)
CREATE POLICY "Owner can view own store profiles" ON profiles
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner');

CREATE POLICY "Manager can view own store profiles" ON profiles
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager');

CREATE POLICY "Owner can update own store profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id());

-- ============================================================
-- STEP 9: RLS Policies — Categories & Products (Public + Admin)
-- ============================================================
DROP POLICY IF EXISTS "Public can view active categories" ON categories;
CREATE POLICY "Public can view active categories" ON categories
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Public can view available products" ON products;
CREATE POLICY "Public can view available products" ON products
    FOR SELECT TO anon, authenticated
    USING (is_available = true);

DROP POLICY IF EXISTS "Owner can manage own store categories" ON categories;
CREATE POLICY "Owner can manage own store categories" ON categories
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');

DROP POLICY IF EXISTS "Manager can manage own store categories" ON categories;
CREATE POLICY "Manager can manage own store categories" ON categories
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'manager');

DROP POLICY IF EXISTS "Owner can manage own store products" ON products;
CREATE POLICY "Owner can manage own store products" ON products
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');

DROP POLICY IF EXISTS "Manager can manage own store products" ON products;
CREATE POLICY "Manager can manage own store products" ON products
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'manager');

DROP POLICY IF EXISTS "Picker can view store categories" ON categories;
CREATE POLICY "Picker can view store categories" ON categories
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'picker');

DROP POLICY IF EXISTS "Picker can view store products" ON products;
CREATE POLICY "Picker can view store products" ON products
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'picker');

-- ============================================================
-- STEP 10: RLS Policies — Addresses
-- ============================================================
DROP POLICY IF EXISTS "Users can view own addresses" ON addresses;
CREATE POLICY "Users can view own addresses" ON addresses
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own addresses" ON addresses;
CREATE POLICY "Users can insert own addresses" ON addresses
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own addresses" ON addresses;
CREATE POLICY "Users can update own addresses" ON addresses
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own addresses" ON addresses;
CREATE POLICY "Users can delete own addresses" ON addresses
    FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view order addresses" ON addresses;
CREATE POLICY "Staff can view order addresses" ON addresses
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.address_id = addresses.id AND orders.store_id = get_user_store_id() AND get_user_role() IN ('owner', 'manager')));

-- ============================================================
-- STEP 11: RLS Policies — Orders
-- ============================================================
DROP POLICY IF EXISTS "Owner can manage own store orders" ON orders;
CREATE POLICY "Owner can manage own store orders" ON orders
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner');

DROP POLICY IF EXISTS "Manager can view own store orders" ON orders;
CREATE POLICY "Manager can view own store orders" ON orders
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager');

DROP POLICY IF EXISTS "Owner can update own store orders" ON orders;
CREATE POLICY "Owner can update own store orders" ON orders
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id());

DROP POLICY IF EXISTS "Manager can update own store orders" ON orders;
CREATE POLICY "Manager can update own store orders" ON orders
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id());

DROP POLICY IF EXISTS "Customers can view own orders" ON orders;
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT TO authenticated
    USING (customer_id = auth.uid() AND get_user_role() = 'customer');

DROP POLICY IF EXISTS "Customers can insert own orders" ON orders;
CREATE POLICY "Customers can insert own orders" ON orders
    FOR INSERT TO authenticated
    WITH CHECK (customer_id = auth.uid() AND get_user_role() = 'customer');

DROP POLICY IF EXISTS "Picker can view assigned orders" ON orders;
CREATE POLICY "Picker can view assigned orders" ON orders
    FOR SELECT TO authenticated
    USING (picker_id = auth.uid() AND get_user_role() = 'picker');

DROP POLICY IF EXISTS "Picker can update assigned orders" ON orders;
CREATE POLICY "Picker can update assigned orders" ON orders
    FOR UPDATE TO authenticated
    USING (picker_id = auth.uid() AND get_user_role() = 'picker')
    WITH CHECK (picker_id = auth.uid());

DROP POLICY IF EXISTS "Rider can view assigned orders" ON orders;
CREATE POLICY "Rider can view assigned orders" ON orders
    FOR SELECT TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider');

DROP POLICY IF EXISTS "Rider can update assigned orders" ON orders;
CREATE POLICY "Rider can update assigned orders" ON orders
    FOR UPDATE TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider')
    WITH CHECK (rider_id = auth.uid());

-- ============================================================
-- STEP 12: RLS Policies — Order Items
-- ============================================================
DROP POLICY IF EXISTS "Owner can view own store order items" ON order_items;
CREATE POLICY "Owner can view own store order items" ON order_items
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.store_id = get_user_store_id() AND get_user_role() = 'owner'));

DROP POLICY IF EXISTS "Manager can view own store order items" ON order_items;
CREATE POLICY "Manager can view own store order items" ON order_items
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.store_id = get_user_store_id() AND get_user_role() = 'manager'));

DROP POLICY IF EXISTS "Customers can view own order items" ON order_items;
CREATE POLICY "Customers can view own order items" ON order_items
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid() AND get_user_role() = 'customer'));

DROP POLICY IF EXISTS "Picker can view assigned order items" ON order_items;
CREATE POLICY "Picker can view assigned order items" ON order_items
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.picker_id = auth.uid() AND get_user_role() = 'picker'));

DROP POLICY IF EXISTS "Picker can update assigned order items" ON order_items;
CREATE POLICY "Picker can update assigned order items" ON order_items
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.picker_id = auth.uid() AND get_user_role() = 'picker'));

DROP POLICY IF EXISTS "Rider can view assigned order items" ON order_items;
CREATE POLICY "Rider can view assigned order items" ON order_items
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.rider_id = auth.uid() AND get_user_role() = 'rider'));

DROP POLICY IF EXISTS "Customers can insert order items" ON order_items;
CREATE POLICY "Customers can insert order items" ON order_items
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()));

-- ============================================================
-- STEP 13: RLS Policies — Rider Verifications
-- ============================================================
DROP POLICY IF EXISTS "Owner can manage rider verifications" ON rider_verifications;
CREATE POLICY "Owner can manage rider verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = rider_verifications.rider_id AND profiles.store_id = get_user_store_id() AND get_user_role() = 'owner'));

DROP POLICY IF EXISTS "Manager can view rider verifications" ON rider_verifications;
CREATE POLICY "Manager can view rider verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = rider_verifications.rider_id AND profiles.store_id = get_user_store_id() AND get_user_role() = 'manager'));

DROP POLICY IF EXISTS "Owner can update rider verifications" ON rider_verifications;
CREATE POLICY "Owner can update rider verifications" ON rider_verifications
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = rider_verifications.rider_id AND profiles.store_id = get_user_store_id() AND get_user_role() = 'owner'));

DROP POLICY IF EXISTS "Rider can view own verifications" ON rider_verifications;
CREATE POLICY "Rider can view own verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider');

DROP POLICY IF EXISTS "Rider can insert own verifications" ON rider_verifications;
CREATE POLICY "Rider can insert own verifications" ON rider_verifications
    FOR INSERT TO authenticated
    WITH CHECK (rider_id = auth.uid() AND get_user_role() = 'rider');

-- ============================================================
-- STEP 14: Seed Data — Store
-- ============================================================
INSERT INTO stores (id, name, slug, address, latitude, longitude, phone, email, base_delivery_fee, per_km_charge, free_delivery_threshold, delivery_radius_km)
VALUES (
    'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
    'Fresh Mart London',
    'fresh-mart-london',
    '123 High Street, Lewisham, London, SE13 6LG',
    51.46120,
    -0.01170,
    '+44 20 1234 5678',
    'hello@freshmartlondon.co.uk',
    3.50,
    0.50,
    20.00,
    5.00
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    is_active = true;

-- ============================================================
-- STEP 15: Seed Data — Categories
-- ============================================================
INSERT INTO categories (id, store_id, name, slug, description, sort_order) VALUES
    ('b1a10000-0000-4a00-b000-000000000001', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Fruits & Vegetables', 'fruits-vegetables', 'Fresh produce delivered daily', 1),
    ('b1a10000-0000-4a00-b000-000000000002', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Dairy & Eggs', 'dairy-eggs', 'Milk, cheese, butter and eggs', 2),
    ('b1a10000-0000-4a00-b000-000000000003', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Meat & Fish', 'meat-fish', 'Fresh meat and fish counter', 3),
    ('b1a10000-0000-4a00-b000-000000000004', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Bakery', 'bakery', 'Freshly baked bread and pastries', 4),
    ('b1a10000-0000-4a00-b000-000000000005', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Pantry', 'pantry', 'Rice, pasta, sauces and more', 5),
    ('b1a10000-0000-4a00-b000-000000000006', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Drinks', 'drinks', 'Juices, water, soft drinks and tea', 6),
    ('b1a10000-0000-4a00-b000-000000000007', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Frozen', 'frozen', 'Frozen meals, ice cream and more', 7),
    ('b1a10000-0000-4a00-b000-000000000008', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Snacks & Sweets', 'snacks-sweets', 'Crisps, biscuits, chocolate and more', 8)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- ============================================================
-- STEP 16: Seed Data — Products (20 items)
-- ============================================================
INSERT INTO products (id, store_id, category_id, name, slug, description, price, vat_rate, is_hfss, unit, is_available, stock_quantity, is_featured) VALUES
    ('a1000000-0000-4a00-b000-000000000001', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'Organic Bananas', 'organic-bananas', 'Fairtrade organic bananas, pack of 6', 1.49, 0.0000, false, 'each', true, 150, true),
    ('a1000000-0000-4a00-b000-000000000002', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'Baby Spinach', 'baby-spinach', 'Fresh baby spinach leaves, 200g bag', 1.89, 0.0000, false, 'each', true, 80, false),
    ('a1000000-0000-4a00-b000-000000000003', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'British Strawberries', 'british-strawberries', 'Sweet British strawberries, 400g', 3.49, 0.0000, false, 'each', true, 45, true),
    ('a1000000-0000-4a00-b000-000000000004', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Free Range Eggs', 'free-range-eggs', 'Free range large eggs, pack of 12', 2.79, 0.0000, false, 'each', true, 100, true),
    ('a1000000-0000-4a00-b000-000000000005', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Semi-Skimmed Milk', 'semi-skimmed-milk', 'British semi-skimmed milk, 2 litres', 1.65, 0.0000, false, 'each', true, 200, false),
    ('a1000000-0000-4a00-b000-000000000006', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Mature Cheddar', 'mature-cheddar', 'Strong mature cheddar cheese, 400g', 3.29, 0.0000, false, 'each', true, 60, false),
    ('a1000000-0000-4a00-b000-000000000007', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000003', 'Chicken Breast', 'chicken-breast', 'Free range chicken breast fillets, 500g', 5.99, 0.0000, false, 'kg', true, 40, true),
    ('a1000000-0000-4a00-b000-000000000008', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000003', 'Scottish Salmon Fillet', 'scottish-salmon-fillet', 'Fresh Scottish salmon fillet, 200g', 6.49, 0.0000, false, 'each', true, 25, false),
    ('a1000000-0000-4a00-b000-000000000009', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000004', 'Sourdough Loaf', 'sourdough-loaf', 'Artisan sourdough bread, freshly baked', 3.49, 0.0000, false, 'each', true, 30, true),
    ('a1000000-0000-4a00-b000-000000000010', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000004', 'Croissants', 'croissants', 'Butter croissants, pack of 4', 2.29, 0.0000, false, 'each', true, 50, false),
    ('a1000000-0000-4a00-b000-000000000011', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Basmati Rice', 'basmati-rice', 'Premium basmati rice, 1kg', 2.99, 0.0000, false, 'each', true, 90, false),
    ('a1000000-0000-4a00-b000-000000000012', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Penne Pasta', 'penne-pasta', 'Italian penne pasta, 500g', 1.29, 0.0000, false, 'each', true, 120, false),
    ('a1000000-0000-4a00-b000-000000000013', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000006', 'Orange Juice', 'orange-juice', 'Freshly squeezed orange juice, 1L', 2.49, 0.0000, false, 'each', true, 75, true),
    ('a1000000-0000-4a00-b000-000000000014', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000006', 'Coca-Cola', 'coca-cola', 'Classic Coca-Cola, 1.5L bottle', 1.99, 0.2000, true, 'each', true, 100, false),
    ('a1000000-0000-4a00-b000-000000000015', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000007', 'Frozen Pizza', 'frozen-pizza', 'Stone baked margherita pizza', 3.49, 0.0000, true, 'each', true, 55, false),
    ('a1000000-0000-4a00-b000-000000000016', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Salt & Vinegar Crisps', 'salt-vinegar-crisps', 'Classic salt and vinegar crisps, 150g', 1.59, 0.2000, true, 'each', true, 80, false),
    ('a1000000-0000-4a00-b000-000000000017', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Dark Chocolate Bar', 'dark-chocolate-bar', '70% cocoa dark chocolate, 100g', 1.89, 0.0000, true, 'each', true, 60, false),
    ('a1000000-0000-4a00-b000-000000000018', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Mixed Nuts', 'mixed-nuts', 'Roasted and salted mixed nuts, 200g', 3.29, 0.0000, false, 'each', true, 40, false),
    ('a1000000-0000-4a00-b000-000000000019', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Greek Yogurt', 'greek-yogurt', 'Thick and creamy Greek yogurt, 500g', 2.49, 0.0000, false, 'each', true, 70, true),
    ('a1000000-0000-4a00-b000-000000000020', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Extra Virgin Olive Oil', 'extra-virgin-olive-oil', 'Italian extra virgin olive oil, 500ml', 5.99, 0.0000, false, 'each', true, 35, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    price = EXCLUDED.price,
    is_available = EXCLUDED.is_available,
    stock_quantity = EXCLUDED.stock_quantity,
    is_featured = EXCLUDED.is_featured;

-- ============================================================
-- STEP 17: Fix any existing profiles with NULL store_id
-- ============================================================
UPDATE profiles
SET store_id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'
WHERE store_id IS NULL
AND EXISTS (SELECT 1 FROM stores WHERE id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890');

-- ============================================================
-- DONE! Verify with these queries:
-- ============================================================
-- SELECT count(*) as stores FROM stores;           -- expect: 1
-- SELECT count(*) as categories FROM categories;    -- expect: 8
-- SELECT count(*) as products FROM products;        -- expect: 20
-- SELECT proname FROM pg_proc WHERE proname IN ('handle_new_user', 'get_user_role', 'get_user_store_id');  -- expect: 3 functions

-- ── MIGRATION 8: Urgent Fix Registration ──

-- ============================================================
-- URGENT FIX: Make Registration Work
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- This script fixes 3 things:
-- 1. Makes profiles.store_id nullable (allows registration)
-- 2. Creates/fixes the auth trigger (auto-creates profile on signup)
-- 3. Adds public RLS policies (browse without login)
--
-- Safe to re-run. Takes 10 seconds.
-- ============================================================

-- FIX 1: Make store_id nullable (THE MAIN BUG)
ALTER TABLE profiles ALTER COLUMN store_id DROP NOT NULL;

-- FIX 2: Create the auth trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    SELECT id INTO default_store_id FROM stores WHERE is_active = true LIMIT 1;

    INSERT INTO profiles (id, store_id, email, full_name, role)
    VALUES (
        NEW.id,
        default_store_id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Customer'),
        'customer'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- FIX 3: Public read access for browsing (without login)
DROP POLICY IF EXISTS "Public can view active stores" ON stores;
CREATE POLICY "Public can view active stores" ON stores
    FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active categories" ON categories;
CREATE POLICY "Public can view active categories" ON categories
    FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public can view available products" ON products;
CREATE POLICY "Public can view available products" ON products
    FOR SELECT TO anon, authenticated USING (is_available = true);

-- FIX 4: Profile self-service (avoids RLS deadlock for new users)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- FIX 5: Link any existing orphaned profiles to the default store
UPDATE profiles
SET store_id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'
WHERE store_id IS NULL
AND EXISTS (SELECT 1 FROM stores WHERE id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890');

-- ── SEED DATA ──

-- ============================================================
-- UK Grocery Store - Seed Data
-- For development and testing environments only
-- All UUIDs use valid hex characters (0-9, a-f) only
-- ============================================================

-- Insert default store (London demo store)
INSERT INTO stores (id, name, slug, address, latitude, longitude, phone, email, base_delivery_fee, per_km_charge, free_delivery_threshold, delivery_radius_km)
VALUES (
    'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
    'Fresh Mart London',
    'fresh-mart-london',
    '123 High Street, Lewisham, London, SE13 6LG',
    51.46120,
    -0.01170,
    '+44 20 1234 5678',
    'hello@freshmartlondon.co.uk',
    3.50,
    0.50,
    20.00,
    5.00
);

-- Insert demo categories
INSERT INTO categories (id, store_id, name, slug, description, sort_order) VALUES
('b1a10000-0000-4a00-b000-000000000001', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Fruits & Vegetables', 'fruits-vegetables', 'Fresh produce delivered daily', 1),
('b1a10000-0000-4a00-b000-000000000002', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Dairy & Eggs', 'dairy-eggs', 'Milk, cheese, butter and eggs', 2),
('b1a10000-0000-4a00-b000-000000000003', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Meat & Fish', 'meat-fish', 'Fresh meat and fish counter', 3),
('b1a10000-0000-4a00-b000-000000000004', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Bakery', 'bakery', 'Freshly baked bread and pastries', 4),
('b1a10000-0000-4a00-b000-000000000005', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Pantry', 'pantry', 'Rice, pasta, sauces and more', 5),
('b1a10000-0000-4a00-b000-000000000006', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Drinks', 'drinks', 'Juices, water, soft drinks and tea', 6),
('b1a10000-0000-4a00-b000-000000000007', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Frozen', 'frozen', 'Frozen meals, ice cream and more', 7),
('b1a10000-0000-4a00-b000-000000000008', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Snacks & Sweets', 'snacks-sweets', 'Crisps, biscuits, chocolate and more', 8);

-- Insert sample products (20 items across categories)
-- Note: 0% VAT on most food, 20% on soft drinks, 5% on some items
INSERT INTO products (id, store_id, category_id, name, slug, description, price, vat_rate, is_hfss, unit, is_available, stock_quantity, is_featured) VALUES
-- Fruits & Vegetables (0% VAT)
('a1000000-0000-4a00-b000-000000000001', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'Organic Bananas', 'organic-bananas', 'Fairtrade organic bananas, pack of 6', 1.49, 0.0000, false, 'each', true, 150, true),
('a1000000-0000-4a00-b000-000000000002', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'Baby Spinach', 'baby-spinach', 'Fresh baby spinach leaves, 200g bag', 1.89, 0.0000, false, 'each', true, 80, false),
('a1000000-0000-4a00-b000-000000000003', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'British Strawberries', 'british-strawberries', 'Sweet British strawberries, 400g', 3.49, 0.0000, false, 'each', true, 45, true),

-- Dairy & Eggs (0% VAT)
('a1000000-0000-4a00-b000-000000000004', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Free Range Eggs', 'free-range-eggs', 'Free range large eggs, pack of 12', 2.79, 0.0000, false, 'each', true, 100, true),
('a1000000-0000-4a00-b000-000000000005', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Semi-Skimmed Milk', 'semi-skimmed-milk', 'British semi-skimmed milk, 2 litres', 1.65, 0.0000, false, 'each', true, 200, false),
('a1000000-0000-4a00-b000-000000000006', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Mature Cheddar', 'mature-cheddar', 'Strong mature cheddar cheese, 400g', 3.29, 0.0000, false, 'each', true, 60, false),

-- Meat & Fish (0% VAT)
('a1000000-0000-4a00-b000-000000000007', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000003', 'Chicken Breast', 'chicken-breast', 'Free range chicken breast fillets, 500g', 5.99, 0.0000, false, 'kg', true, 40, true),
('a1000000-0000-4a00-b000-000000000008', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000003', 'Scottish Salmon Fillet', 'scottish-salmon-fillet', 'Fresh Scottish salmon fillet, 200g', 6.49, 0.0000, false, 'each', true, 25, false),

-- Bakery (0% VAT)
('a1000000-0000-4a00-b000-000000000009', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000004', 'Sourdough Loaf', 'sourdough-loaf', 'Artisan sourdough bread, freshly baked', 3.49, 0.0000, false, 'each', true, 30, true),
('a1000000-0000-4a00-b000-000000000010', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000004', 'Croissants', 'croissants', 'Butter croissants, pack of 4', 2.29, 0.0000, false, 'each', true, 50, false),

-- Pantry (0% VAT)
('a1000000-0000-4a00-b000-000000000011', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Basmati Rice', 'basmati-rice', 'Premium basmati rice, 1kg', 2.99, 0.0000, false, 'each', true, 90, false),
('a1000000-0000-4a00-b000-000000000012', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Penne Pasta', 'penne-pasta', 'Italian penne pasta, 500g', 1.29, 0.0000, false, 'each', true, 120, false),

-- Drinks (0% VAT on juice/water, 20% on soft drinks)
('a1000000-0000-4a00-b000-000000000013', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000006', 'Orange Juice', 'orange-juice', 'Freshly squeezed orange juice, 1L', 2.49, 0.0000, false, 'each', true, 75, true),
('a1000000-0000-4a00-b000-000000000014', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000006', 'Coca-Cola', 'coca-cola', 'Classic Coca-Cola, 1.5L bottle', 1.99, 0.2000, true, 'each', true, 100, false),

-- Frozen (0% VAT)
('a1000000-0000-4a00-b000-000000000015', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000007', 'Frozen Pizza', 'frozen-pizza', 'Stone baked margherita pizza', 3.49, 0.0000, true, 'each', true, 55, false),

-- Snacks & Sweets (0% VAT on most, HFSS flagged items)
('a1000000-0000-4a00-b000-000000000016', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Salt & Vinegar Crisps', 'salt-vinegar-crisps', 'Classic salt and vinegar crisps, 150g', 1.59, 0.2000, true, 'each', true, 80, false),
('a1000000-0000-4a00-b000-000000000017', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Dark Chocolate Bar', 'dark-chocolate-bar', '70% cocoa dark chocolate, 100g', 1.89, 0.0000, true, 'each', true, 60, false),
('a1000000-0000-4a00-b000-000000000018', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Mixed Nuts', 'mixed-nuts', 'Roasted and salted mixed nuts, 200g', 3.29, 0.0000, false, 'each', true, 40, false),

-- More featured items
('a1000000-0000-4a00-b000-000000000019', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Greek Yogurt', 'greek-yogurt', 'Thick and creamy Greek yogurt, 500g', 2.49, 0.0000, false, 'each', true, 70, true),
('a1000000-0000-4a00-b000-000000000020', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Extra Virgin Olive Oil', 'extra-virgin-olive-oil', 'Italian extra virgin olive oil, 500ml', 5.99, 0.0000, false, 'each', true, 35, true);

-- ── VERIFICATION ──
SELECT 'stores' as table_name, count(*) as row_count FROM stores
UNION ALL SELECT 'categories', count(*) FROM categories
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'store_settings', count(*) FROM store_settings;
