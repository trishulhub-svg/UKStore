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
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
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
