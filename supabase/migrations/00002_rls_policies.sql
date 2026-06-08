-- ============================================================
-- UK Grocery Store - Row Level Security Policies
-- Per Backend Schema Document (Section 5.4)
-- Every table enforces RLS scoped to user roles
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_verifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STORES: RLS Policies
-- ============================================================

-- Owner: Full access to own store only
CREATE POLICY "Owner can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'owner');

-- Manager: View own store
CREATE POLICY "Manager can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'manager');

-- Customer: View active stores only
CREATE POLICY "Customers can view active stores" ON stores
    FOR SELECT TO authenticated
    USING (is_active = true AND get_user_role() = 'customer');

-- Picker/Rider: View own store
CREATE POLICY "Staff can view own store" ON stores
    FOR SELECT TO authenticated
    USING (id = get_user_store_id() AND get_user_role() IN ('picker', 'rider'));

-- Owner: Update own store
CREATE POLICY "Owner can update own store" ON stores
    FOR UPDATE TO authenticated
    USING (id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (id = get_user_store_id() AND get_user_role() = 'owner');

-- Owner: Insert (for new store creation)
CREATE POLICY "Owner can insert store" ON stores
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() = 'owner');

-- ============================================================
-- PROFILES: RLS Policies
-- ============================================================

-- Owner: View all staff in own store
CREATE POLICY "Owner can view own store profiles" ON profiles
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner');

-- Manager: View all staff in own store
CREATE POLICY "Manager can view own store profiles" ON profiles
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Customer: View own profile only
CREATE POLICY "Customers can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() AND get_user_role() = 'customer');

-- Picker/Rider: View own profile only
CREATE POLICY "Staff can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() AND get_user_role() IN ('picker', 'rider'));

-- All users: Insert own profile (during signup)
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Owner: Update staff in own store
CREATE POLICY "Owner can update own store profiles" ON profiles
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id());

-- Customer: Update own profile
CREATE POLICY "Customers can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() AND get_user_role() = 'customer')
    WITH CHECK (id = auth.uid());

-- Picker/Rider: Update own profile
CREATE POLICY "Staff can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() AND get_user_role() IN ('picker', 'rider'))
    WITH CHECK (id = auth.uid());

-- ============================================================
-- CATEGORIES: RLS Policies
-- ============================================================

-- Owner/Manager: Full CRUD on own store categories
CREATE POLICY "Owner can manage own store categories" ON categories
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');

CREATE POLICY "Manager can manage own store categories" ON categories
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Customer: View active categories only
CREATE POLICY "Customers can view active categories" ON categories
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Picker: View categories for picking
CREATE POLICY "Picker can view store categories" ON categories
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'picker');

-- ============================================================
-- PRODUCTS: RLS Policies
-- ============================================================

-- Owner/Manager: Full CRUD on own store products
CREATE POLICY "Owner can manage own store products" ON products
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'owner');

CREATE POLICY "Manager can manage own store products" ON products
    FOR ALL TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id() AND get_user_role() = 'manager');

-- Customer: View available products only
CREATE POLICY "Customers can view available products" ON products
    FOR SELECT TO authenticated
    USING (is_available = true);

-- Picker: View products for picking
CREATE POLICY "Picker can view store products" ON products
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'picker');

-- ============================================================
-- ADDRESSES: RLS Policies
-- ============================================================

-- Users: Full access to own addresses only
CREATE POLICY "Users can view own addresses" ON addresses
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own addresses" ON addresses
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own addresses" ON addresses
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own addresses" ON addresses
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Owner/Manager: View delivery addresses for own store orders
CREATE POLICY "Staff can view order addresses" ON addresses
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.address_id = addresses.id
            AND orders.store_id = get_user_store_id()
            AND get_user_role() IN ('owner', 'manager')
        )
    );

-- ============================================================
-- ORDERS: RLS Policies
-- ============================================================

-- Owner/Manager: View and update own store orders
CREATE POLICY "Owner can manage own store orders" ON orders
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner');

CREATE POLICY "Manager can view own store orders" ON orders
    FOR SELECT TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager');

CREATE POLICY "Owner can update own store orders" ON orders
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'owner')
    WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Manager can update own store orders" ON orders
    FOR UPDATE TO authenticated
    USING (store_id = get_user_store_id() AND get_user_role() = 'manager')
    WITH CHECK (store_id = get_user_store_id());

-- Customer: View and create own orders only
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT TO authenticated
    USING (customer_id = auth.uid() AND get_user_role() = 'customer');

CREATE POLICY "Customers can insert own orders" ON orders
    FOR INSERT TO authenticated
    WITH CHECK (customer_id = auth.uid() AND get_user_role() = 'customer');

-- Picker: View and update assigned orders
CREATE POLICY "Picker can view assigned orders" ON orders
    FOR SELECT TO authenticated
    USING (picker_id = auth.uid() AND get_user_role() = 'picker');

CREATE POLICY "Picker can update assigned orders" ON orders
    FOR UPDATE TO authenticated
    USING (picker_id = auth.uid() AND get_user_role() = 'picker')
    WITH CHECK (picker_id = auth.uid());

-- Rider: View and update assigned orders
CREATE POLICY "Rider can view assigned orders" ON orders
    FOR SELECT TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider');

CREATE POLICY "Rider can update assigned orders" ON orders
    FOR UPDATE TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider')
    WITH CHECK (rider_id = auth.uid());

-- ============================================================
-- ORDER_ITEMS: RLS Policies
-- ============================================================

-- Follow the same access pattern as orders
CREATE POLICY "Owner can view own store order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.store_id = get_user_store_id()
            AND get_user_role() = 'owner'
        )
    );

CREATE POLICY "Manager can view own store order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.store_id = get_user_store_id()
            AND get_user_role() = 'manager'
        )
    );

CREATE POLICY "Customers can view own order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.customer_id = auth.uid()
            AND get_user_role() = 'customer'
        )
    );

CREATE POLICY "Picker can view assigned order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.picker_id = auth.uid()
            AND get_user_role() = 'picker'
        )
    );

CREATE POLICY "Picker can update assigned order items" ON order_items
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.picker_id = auth.uid()
            AND get_user_role() = 'picker'
        )
    );

CREATE POLICY "Rider can view assigned order items" ON order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.rider_id = auth.uid()
            AND get_user_role() = 'rider'
        )
    );

CREATE POLICY "Customers can insert order items" ON order_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.customer_id = auth.uid()
        )
    );

-- ============================================================
-- RIDER_VERIFICATIONS: RLS Policies
-- ============================================================

-- Owner/Manager: View and approve/reject own store rider verifications
CREATE POLICY "Owner can manage rider verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = rider_verifications.rider_id
            AND profiles.store_id = get_user_store_id()
            AND get_user_role() = 'owner'
        )
    );

CREATE POLICY "Manager can view rider verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = rider_verifications.rider_id
            AND profiles.store_id = get_user_store_id()
            AND get_user_role() = 'manager'
        )
    );

CREATE POLICY "Owner can update rider verifications" ON rider_verifications
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = rider_verifications.rider_id
            AND profiles.store_id = get_user_store_id()
            AND get_user_role() = 'owner'
        )
    );

-- Rider: View and upload own documents
CREATE POLICY "Rider can view own verifications" ON rider_verifications
    FOR SELECT TO authenticated
    USING (rider_id = auth.uid() AND get_user_role() = 'rider');

CREATE POLICY "Rider can insert own verifications" ON rider_verifications
    FOR INSERT TO authenticated
    WITH CHECK (rider_id = auth.uid() AND get_user_role() = 'rider');
