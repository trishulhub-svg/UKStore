-- ============================================================
-- UK Grocery Store - Auth Trigger
-- Auto-creates profile when new user signs up via Supabase Auth
-- ============================================================

-- Function to handle new user signup
-- Creates a profile row automatically when a user registers
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    -- Get the first active store as default (for single-store MVP)
    SELECT id INTO default_store_id FROM stores WHERE is_active = true LIMIT 1;

    -- Insert profile with customer role by default
    -- Staff roles are assigned by store owner through admin dashboard
    INSERT INTO profiles (id, store_id, email, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(default_store_id, '00000000-0000-0000-0000-000000000000'),
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Customer'),
        'customer'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: After insert on auth.users, create profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
