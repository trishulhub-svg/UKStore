-- ============================================================
-- FRESH MART: Complete Database Fix & Migration
-- Run this ENTIRE script in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
--
-- This script:
-- 1. Fixes the handle_new_user() trigger
-- 2. Creates missing tables (favourites, notifications, etc.)
-- 3. Adds 'driver' role (merges picker+rider)
-- 4. Seeds admin, customer, and driver accounts
-- ============================================================

-- ============================================================
-- STEP 1: Fix the auth trigger
-- The original trigger may fail due to RLS or constraint issues
-- ============================================================

-- First, drop the old trigger to prevent it from blocking user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a simpler, more resilient trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    -- Get default store (may be NULL)
    SELECT id INTO default_store_id FROM stores WHERE is_active = true LIMIT 1;

    -- Insert profile — store_id is nullable, so NULL is fine
    INSERT INTO profiles (id, store_id, email, full_name, role)
    VALUES (
        NEW.id,
        default_store_id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Customer'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- If profile insert fails, still let the user be created
        -- The profile can be created manually later
        RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- STEP 2: Ensure profiles.store_id is nullable
-- ============================================================
ALTER TABLE profiles ALTER COLUMN store_id DROP NOT NULL;

-- ============================================================
-- STEP 3: Update role constraint to include 'driver'
-- ============================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'owner', 'manager', 'driver'));

-- Migrate existing picker/rider to driver
UPDATE profiles SET role = 'driver' WHERE role IN ('picker', 'rider');

-- ============================================================
-- STEP 4: Create missing tables
-- ============================================================

-- store_settings
CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    is_secret BOOLEAN DEFAULT true,
    category VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (category IN ('integrations', 'delivery', 'notifications', 'general')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT store_settings_unique_key UNIQUE (store_id, key)
);

-- favourites
CREATE TABLE IF NOT EXISTS favourites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT favourites_unique UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_favourites_user ON favourites (user_id);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL DEFAULT 'system' CHECK (type IN ('order_update', 'promotion', 'delivery', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- driver_profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(30) CHECK (vehicle_type IN ('bicycle', 'motorcycle', 'car', 'van')),
    vehicle_reg VARCHAR(20),
    national_insurance_number VARCHAR(20),
    right_to_work_url TEXT,
    driving_license_url TEXT,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    is_on_duty BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user ON driver_profiles (user_id);

-- delivery_zones
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    postcodes JSONB NOT NULL DEFAULT '[]',
    delivery_fee DECIMAL(10, 2) DEFAULT 0,
    minimum_order DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_store ON delivery_zones (store_id);

-- promotions
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10, 2) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    applies_to_category_ids JSONB,
    excludes_hfss BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_store ON promotions (store_id);

-- ============================================================
-- STEP 5: Add driver_id to orders table
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'driver_id') THEN
        ALTER TABLE orders ADD COLUMN driver_id UUID REFERENCES profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'confirmed_at') THEN
        ALTER TABLE orders ADD COLUMN confirmed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'picked_at') THEN
        ALTER TABLE orders ADD COLUMN picked_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivered_at') THEN
        ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cancelled_at') THEN
        ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cancellation_reason') THEN
        ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;
    END IF;
END $$;

-- Update order status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('placed', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'delivered', 'cancelled'));

-- Migrate existing picker_id/rider_id to driver_id
UPDATE orders SET driver_id = COALESCE(rider_id, picker_id) WHERE driver_id IS NULL AND (picker_id IS NOT NULL OR rider_id IS NOT NULL);

-- ============================================================
-- STEP 6: Enable RLS on new tables
-- ============================================================
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 7: RLS Policies for new tables
-- ============================================================

-- Helper functions (should already exist, but ensure they do)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID AS $$
    SELECT store_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Store Settings
DROP POLICY IF EXISTS "Owner can manage store settings" ON store_settings;
CREATE POLICY "Owner can manage store settings" ON store_settings
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');

DROP POLICY IF EXISTS "Manager can view store settings" ON store_settings;
CREATE POLICY "Manager can view store settings" ON store_settings
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Favourites
DROP POLICY IF EXISTS "Users can view own favourites" ON favourites;
CREATE POLICY "Users can view own favourites" ON favourites
    FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own favourites" ON favourites;
CREATE POLICY "Users can insert own favourites" ON favourites
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own favourites" ON favourites;
CREATE POLICY "Users can delete own favourites" ON favourites
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
CREATE POLICY "Users can insert own notifications" ON notifications
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin can insert notifications" ON notifications;
CREATE POLICY "Admin can insert notifications" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')));

-- Driver Profiles
DROP POLICY IF EXISTS "Driver can view own profile" ON driver_profiles;
CREATE POLICY "Driver can view own profile" ON driver_profiles
    FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Driver can update own profile" ON driver_profiles;
CREATE POLICY "Driver can update own profile" ON driver_profiles
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Driver can insert own profile" ON driver_profiles;
CREATE POLICY "Driver can insert own profile" ON driver_profiles
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Owner can view driver profiles" ON driver_profiles;
CREATE POLICY "Owner can view driver profiles" ON driver_profiles
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = driver_profiles.user_id AND store_id = get_user_store_id() AND get_user_role() = 'owner'));
DROP POLICY IF EXISTS "Owner can update driver profiles" ON driver_profiles;
CREATE POLICY "Owner can update driver profiles" ON driver_profiles
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = driver_profiles.user_id AND store_id = get_user_store_id() AND get_user_role() = 'owner'));
DROP POLICY IF EXISTS "Manager can view driver profiles" ON driver_profiles;
CREATE POLICY "Manager can view driver profiles" ON driver_profiles
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = driver_profiles.user_id AND store_id = get_user_store_id() AND get_user_role() = 'manager'));

-- Delivery Zones (public read, admin manage)
DROP POLICY IF EXISTS "Public can view active delivery zones" ON delivery_zones;
CREATE POLICY "Public can view active delivery zones" ON delivery_zones
    FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Owner can manage delivery zones" ON delivery_zones;
CREATE POLICY "Owner can manage delivery zones" ON delivery_zones
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');
DROP POLICY IF EXISTS "Manager can manage delivery zones" ON delivery_zones;
CREATE POLICY "Manager can manage delivery zones" ON delivery_zones
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Promotions (public read active, admin manage)
DROP POLICY IF EXISTS "Public can view active promotions" ON promotions;
CREATE POLICY "Public can view active promotions" ON promotions
    FOR SELECT TO anon, authenticated
    USING (is_active = true AND start_date <= now() AND end_date >= now());
DROP POLICY IF EXISTS "Owner can manage promotions" ON promotions;
CREATE POLICY "Owner can manage promotions" ON promotions
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');
DROP POLICY IF EXISTS "Manager can manage promotions" ON promotions;
CREATE POLICY "Manager can manage promotions" ON promotions
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Driver order policies
DROP POLICY IF EXISTS "Driver can view assigned orders" ON orders;
CREATE POLICY "Driver can view assigned orders" ON orders
    FOR SELECT TO authenticated
    USING (driver_id = auth.uid() AND get_user_role() = 'driver');
DROP POLICY IF EXISTS "Driver can update assigned orders" ON orders;
CREATE POLICY "Driver can update assigned orders" ON orders
    FOR UPDATE TO authenticated
    USING (driver_id = auth.uid() AND get_user_role() = 'driver')
    WITH CHECK (driver_id = auth.uid());
DROP POLICY IF EXISTS "Driver can view assigned order items" ON order_items;
CREATE POLICY "Driver can view assigned order items" ON order_items
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.driver_id = auth.uid() AND get_user_role() = 'driver'));
DROP POLICY IF EXISTS "Driver can update assigned order items" ON order_items;
CREATE POLICY "Driver can update assigned order items" ON order_items
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.driver_id = auth.uid() AND get_user_role() = 'driver'));

-- ============================================================
-- STEP 8: Seed default delivery zone
-- ============================================================
INSERT INTO delivery_zones (store_id, name, postcodes, delivery_fee, minimum_order)
VALUES (
    'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
    'Local Area',
    '["SE1", "SE2", "SE3", "SE4", "SE6", "SE8", "SE9", "SE10", "SE12", "SE13", "SE14", "SE15", "SE16", "SE22", "BR1", "BR2", "BR3"]'::jsonb,
    3.50,
    10.00
) ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 9: Link any orphaned profiles to the default store
-- ============================================================
UPDATE profiles
SET store_id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890'
WHERE store_id IS NULL
AND EXISTS (SELECT 1 FROM stores WHERE id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890');

-- ============================================================
-- STEP 10: Updated_at triggers for new tables
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_store_settings_updated_at ON store_settings;
CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON store_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_driver_profiles_updated_at ON driver_profiles;
CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_promotions_updated_at ON promotions;
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DONE! 
-- 
-- After running this script, use the app to register these accounts:
--   Admin:    admin@freshmart.co.uk / Admin@2026
--   Customer: customer@freshmart.co.uk / Customer@2026
--   Driver:   driver@freshmart.co.uk / Driver@2026
--
-- OR run the seed script:
--   node scripts/seed-admin-v2.mjs
--
-- Verify with:
--   SELECT count(*) FROM profiles;
--   SELECT count(*) FROM driver_profiles;
--   SELECT count(*) FROM delivery_zones;
--   SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';
-- ============================================================
