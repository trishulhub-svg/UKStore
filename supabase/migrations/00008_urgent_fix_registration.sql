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
