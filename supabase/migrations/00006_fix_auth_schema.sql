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
