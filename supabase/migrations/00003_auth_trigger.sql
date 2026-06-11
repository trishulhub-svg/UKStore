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
