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
