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
