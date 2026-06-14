-- ============================================================
-- FRESH MART: Fix Auth Trigger & Seed Users
-- Run this ENTIRE script in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- STEP 1: Drop the broken trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- STEP 2: Replace with a simple, resilient trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    -- Get default store (may be NULL if no stores exist yet)
    BEGIN
        SELECT id INTO default_store_id FROM stores WHERE is_active = true LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        default_store_id := NULL;
    END;

    -- Insert profile — store_id is nullable
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
        -- The profile can be created/updated manually later
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Re-create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- STEP 4: Seed admin user (owner role)
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
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
    '',
    '',
    '',
    ''
) ON CONFLICT (email) DO NOTHING;

-- STEP 5: Seed customer user
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
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
    '',
    '',
    '',
    ''
) ON CONFLICT (email) DO NOTHING;

-- STEP 6: Seed driver user
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
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
    '',
    '',
    '',
    ''
) ON CONFLICT (email) DO NOTHING;

-- STEP 7: Verify the trigger created profiles (should happen automatically)
-- If profiles weren't auto-created by the trigger, insert them manually:
INSERT INTO profiles (id, store_id, email, full_name, role, is_active)
SELECT id, 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', email, 
    COALESCE(raw_user_meta_data->>'full_name', 'User'),
    COALESCE(raw_user_meta_data->>'role', 'customer'),
    true
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- STEP 8: Create driver profile for driver user
INSERT INTO driver_profiles (user_id, vehicle_type, verification_status, is_on_duty)
SELECT id, 'bicycle', 'approved', false
FROM auth.users
WHERE email = 'driver@freshmart.co.uk'
AND id NOT IN (SELECT user_id FROM driver_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- STEP 9: Seed delivery zone (if not exists)
INSERT INTO delivery_zones (store_id, name, postcodes, delivery_fee, minimum_order, is_active)
VALUES (
    'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
    'Local Area',
    '["SE1", "SE2", "SE3", "SE4", "SE6", "SE8", "SE9", "SE10", "SE12", "SE13", "SE14", "SE15", "SE16", "SE22", "BR1", "BR2", "BR3"]'::jsonb,
    3.50,
    10.00,
    true
) ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICATION QUERIES (run these separately to verify)
-- ============================================================
-- SELECT email, raw_user_meta_data FROM auth.users ORDER BY created_at;
-- SELECT email, role, full_name FROM profiles ORDER BY created_at;
-- SELECT count(*) FROM driver_profiles;
-- SELECT count(*) FROM delivery_zones;
