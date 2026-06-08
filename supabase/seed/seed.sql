-- ============================================================
-- UK Grocery Store - Seed Data
-- For development and testing environments only
-- All UUIDs use valid hex characters (0-9, a-f) only
-- ============================================================

-- Insert default store (London demo store)
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
);

-- Insert demo categories
INSERT INTO categories (id, store_id, name, slug, description, sort_order) VALUES
('b1a10000-0000-4a00-b000-000000000001', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Fruits & Vegetables', 'fruits-vegetables', 'Fresh produce delivered daily', 1),
('b1a10000-0000-4a00-b000-000000000002', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Dairy & Eggs', 'dairy-eggs', 'Milk, cheese, butter and eggs', 2),
('b1a10000-0000-4a00-b000-000000000003', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Meat & Fish', 'meat-fish', 'Fresh meat and fish counter', 3),
('b1a10000-0000-4a00-b000-000000000004', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Bakery', 'bakery', 'Freshly baked bread and pastries', 4),
('b1a10000-0000-4a00-b000-000000000005', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Pantry', 'pantry', 'Rice, pasta, sauces and more', 5),
('b1a10000-0000-4a00-b000-000000000006', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Drinks', 'drinks', 'Juices, water, soft drinks and tea', 6),
('b1a10000-0000-4a00-b000-000000000007', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Frozen', 'frozen', 'Frozen meals, ice cream and more', 7),
('b1a10000-0000-4a00-b000-000000000008', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'Snacks & Sweets', 'snacks-sweets', 'Crisps, biscuits, chocolate and more', 8);

-- Insert sample products (20 items across categories)
-- Note: 0% VAT on most food, 20% on soft drinks, 5% on some items
INSERT INTO products (id, store_id, category_id, name, slug, description, price, vat_rate, is_hfss, unit, is_available, stock_quantity, is_featured) VALUES
-- Fruits & Vegetables (0% VAT)
('a1000000-0000-4a00-b000-000000000001', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'Organic Bananas', 'organic-bananas', 'Fairtrade organic bananas, pack of 6', 1.49, 0.0000, false, 'each', true, 150, true),
('a1000000-0000-4a00-b000-000000000002', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'Baby Spinach', 'baby-spinach', 'Fresh baby spinach leaves, 200g bag', 1.89, 0.0000, false, 'each', true, 80, false),
('a1000000-0000-4a00-b000-000000000003', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000001', 'British Strawberries', 'british-strawberries', 'Sweet British strawberries, 400g', 3.49, 0.0000, false, 'each', true, 45, true),

-- Dairy & Eggs (0% VAT)
('a1000000-0000-4a00-b000-000000000004', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Free Range Eggs', 'free-range-eggs', 'Free range large eggs, pack of 12', 2.79, 0.0000, false, 'each', true, 100, true),
('a1000000-0000-4a00-b000-000000000005', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Semi-Skimmed Milk', 'semi-skimmed-milk', 'British semi-skimmed milk, 2 litres', 1.65, 0.0000, false, 'each', true, 200, false),
('a1000000-0000-4a00-b000-000000000006', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Mature Cheddar', 'mature-cheddar', 'Strong mature cheddar cheese, 400g', 3.29, 0.0000, false, 'each', true, 60, false),

-- Meat & Fish (0% VAT)
('a1000000-0000-4a00-b000-000000000007', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000003', 'Chicken Breast', 'chicken-breast', 'Free range chicken breast fillets, 500g', 5.99, 0.0000, false, 'kg', true, 40, true),
('a1000000-0000-4a00-b000-000000000008', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000003', 'Scottish Salmon Fillet', 'scottish-salmon-fillet', 'Fresh Scottish salmon fillet, 200g', 6.49, 0.0000, false, 'each', true, 25, false),

-- Bakery (0% VAT)
('a1000000-0000-4a00-b000-000000000009', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000004', 'Sourdough Loaf', 'sourdough-loaf', 'Artisan sourdough bread, freshly baked', 3.49, 0.0000, false, 'each', true, 30, true),
('a1000000-0000-4a00-b000-000000000010', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000004', 'Croissants', 'croissants', 'Butter croissants, pack of 4', 2.29, 0.0000, false, 'each', true, 50, false),

-- Pantry (0% VAT)
('a1000000-0000-4a00-b000-000000000011', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Basmati Rice', 'basmati-rice', 'Premium basmati rice, 1kg', 2.99, 0.0000, false, 'each', true, 90, false),
('a1000000-0000-4a00-b000-000000000012', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Penne Pasta', 'penne-pasta', 'Italian penne pasta, 500g', 1.29, 0.0000, false, 'each', true, 120, false),

-- Drinks (0% VAT on juice/water, 20% on soft drinks)
('a1000000-0000-4a00-b000-000000000013', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000006', 'Orange Juice', 'orange-juice', 'Freshly squeezed orange juice, 1L', 2.49, 0.0000, false, 'each', true, 75, true),
('a1000000-0000-4a00-b000-000000000014', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000006', 'Coca-Cola', 'coca-cola', 'Classic Coca-Cola, 1.5L bottle', 1.99, 0.2000, true, 'each', true, 100, false),

-- Frozen (0% VAT)
('a1000000-0000-4a00-b000-000000000015', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000007', 'Frozen Pizza', 'frozen-pizza', 'Stone baked margherita pizza', 3.49, 0.0000, true, 'each', true, 55, false),

-- Snacks & Sweets (0% VAT on most, HFSS flagged items)
('a1000000-0000-4a00-b000-000000000016', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Salt & Vinegar Crisps', 'salt-vinegar-crisps', 'Classic salt and vinegar crisps, 150g', 1.59, 0.2000, true, 'each', true, 80, false),
('a1000000-0000-4a00-b000-000000000017', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Dark Chocolate Bar', 'dark-chocolate-bar', '70% cocoa dark chocolate, 100g', 1.89, 0.0000, true, 'each', true, 60, false),
('a1000000-0000-4a00-b000-000000000018', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000008', 'Mixed Nuts', 'mixed-nuts', 'Roasted and salted mixed nuts, 200g', 3.29, 0.0000, false, 'each', true, 40, false),

-- More featured items
('a1000000-0000-4a00-b000-000000000019', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000002', 'Greek Yogurt', 'greek-yogurt', 'Thick and creamy Greek yogurt, 500g', 2.49, 0.0000, false, 'each', true, 70, true),
('a1000000-0000-4a00-b000-000000000020', 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890', 'b1a10000-0000-4a00-b000-000000000005', 'Extra Virgin Olive Oil', 'extra-virgin-olive-oil', 'Italian extra virgin olive oil, 500ml', 5.99, 0.0000, false, 'each', true, 35, true);
