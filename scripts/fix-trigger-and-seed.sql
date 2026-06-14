-- ============================================================
-- FRESH MART: Fix Auth Trigger, Constraint & Seed Users
-- Run this ENTIRE script in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- STEP 1: Fix the role check constraint to include 'driver'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'owner', 'manager', 'driver'));

-- Migrate any old picker/rider roles to driver
UPDATE profiles SET role = 'driver' WHERE role IN ('picker', 'rider');

-- STEP 2: Drop and recreate the trigger with a resilient version
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    BEGIN
        SELECT id INTO default_store_id FROM stores WHERE is_active = true LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        default_store_id := NULL;
    END;

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
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- STEP 3: Seed admin user — only if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@freshmart.co.uk') THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'admin@freshmart.co.uk',
            crypt('Admin@2026', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"], "role": "owner"}',
            '{"full_name": "Admin User", "role": "owner"}',
            now(),
            now(),
            '', '', '', ''
        );
    END IF;
END $$;

-- STEP 4: Seed customer user — only if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'customer@freshmart.co.uk') THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'customer@freshmart.co.uk',
            crypt('Customer@2026', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"], "role": "customer"}',
            '{"full_name": "Test Customer", "role": "customer"}',
            now(),
            now(),
            '', '', '', ''
        );
    END IF;
END $$;

-- STEP 5: Seed driver user — only if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'driver@freshmart.co.uk') THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'driver@freshmart.co.uk',
            crypt('Driver@2026', gen_salt('bf')),
            now(),
            '{"provider": "email", "providers": ["email"], "role": "driver"}',
            '{"full_name": "Test Driver", "role": "driver"}',
            now(),
            now(),
            '', '', '', ''
        );
    END IF;
END $$;

-- STEP 6: Fill in any missing profiles
INSERT INTO profiles (id, store_id, email, full_name, role, is_active)
SELECT
    u.id,
    'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(u.raw_user_meta_data->>'role', 'customer'),
    true
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);

-- STEP 7: Create driver profile — only if not exists
INSERT INTO driver_profiles (user_id, vehicle_type, verification_status, is_on_duty)
SELECT u.id, 'bicycle', 'approved', false
FROM auth.users u
WHERE u.email = 'driver@freshmart.co.uk'
AND NOT EXISTS (SELECT 1 FROM driver_profiles dp WHERE dp.user_id = u.id);

-- STEP 8: Seed delivery zone — only if not exists
INSERT INTO delivery_zones (store_id, name, postcodes, delivery_fee, minimum_order, is_active)
SELECT
    'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
    'Local Area',
    '["SE1", "SE2", "SE3", "SE4", "SE6", "SE8", "SE9", "SE10", "SE12", "SE13", "SE14", "SE15", "SE16", "SE22", "BR1", "BR2", "BR3"]'::jsonb,
    3.50,
    10.00,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM delivery_zones WHERE store_id = 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890' AND name = 'Local Area'
);

-- ============================================================
-- DONE! Verify with these queries (run one at a time):
-- ============================================================
-- SELECT email, raw_user_meta_data->>'role' as role FROM auth.users ORDER BY created_at;
-- SELECT email, role, full_name FROM profiles ORDER BY created_at;
-- SELECT count(*) as driver_profiles FROM driver_profiles;
-- SELECT count(*) as delivery_zones FROM delivery_zones;
