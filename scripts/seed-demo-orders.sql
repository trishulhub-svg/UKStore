-- ============================================================
-- FRESH MART: Seed Demo Orders for Admin Dashboard
-- Run this in Supabase SQL Editor to populate sample data
-- so the admin dashboard shows meaningful metrics
-- ============================================================

-- Get the IDs we need
-- Store ID (hardcoded)
-- Customer user ID from profiles
-- Driver user ID from profiles

-- STEP 1: Create sample orders across last 7 days
DO $$
DECLARE
    v_customer_id UUID;
    v_driver_id UUID;
    v_store_id UUID := 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890';
    v_order_id UUID;
    v_product_ids UUID[];
BEGIN
    -- Get customer ID
    SELECT id INTO v_customer_id FROM profiles WHERE email = 'customer@freshmart.co.uk' LIMIT 1;
    -- Get driver ID
    SELECT id INTO v_driver_id FROM profiles WHERE email = 'driver@freshmart.co.uk' LIMIT 1;

    IF v_customer_id IS NULL THEN
        RAISE NOTICE 'No customer found, skipping order seeding';
        RETURN;
    END IF;

    -- Get up to 10 product IDs
    SELECT ARRAY(SELECT id FROM products WHERE store_id = v_store_id LIMIT 10) INTO v_product_ids;

    IF array_length(v_product_ids, 1) IS NULL OR array_length(v_product_ids, 1) = 0 THEN
        RAISE NOTICE 'No products found, skipping order seeding';
        RETURN;
    END IF;

    -- ─── Order 1: Delivered 6 days ago ─────────────────────
    INSERT INTO orders (id, store_id, customer_id, driver_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, v_driver_id, 'delivered',
        18.50, 2.22, 3.50, 24.22, 'paid',
        NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 2 hours'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[1], 'Organic Whole Milk 1L', 2, 1.49, 0.00, 2.98, true),
        (gen_random_uuid(), v_order_id, v_product_ids[2], 'Free Range Eggs (6 pack)', 1, 2.29, 0.20, 2.29, true),
        (gen_random_uuid(), v_order_id, v_product_ids[3], 'Sourdough Bread Loaf', 1, 2.99, 0.00, 2.99, true),
        (gen_random_uuid(), v_order_id, v_product_ids[4], 'British Strawberries 400g', 2, 3.49, 0.20, 6.98, true),
        (gen_random_uuid(), v_order_id, v_product_ids[5], 'Salted Butter 250g', 1, 2.25, 0.20, 2.25, true),
        (gen_random_uuid(), v_order_id, v_product_ids[6], 'Mature Cheddar 350g', 1, 3.50, 0.20, 3.50, true);

    -- ─── Order 2: Delivered 5 days ago ─────────────────────
    INSERT INTO orders (id, store_id, customer_id, driver_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, v_driver_id, 'delivered',
        12.75, 1.53, 3.50, 17.78, 'paid',
        NOW() - INTERVAL '5 days 6 hours', NOW() - INTERVAL '5 days 4 hours'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[7], 'Fairtrade Bananas 5 pack', 2, 0.89, 0.00, 1.78, true),
        (gen_random_uuid(), v_order_id, v_product_ids[8], 'Greek Yogurt 500g', 1, 2.49, 0.20, 2.49, true),
        (gen_random_uuid(), v_order_id, v_product_ids[1], 'Organic Whole Milk 1L', 3, 1.49, 0.00, 4.47, true),
        (gen_random_uuid(), v_order_id, v_product_ids[4], 'British Strawberries 400g', 1, 3.49, 0.20, 3.49, true);

    -- ─── Order 3: Delivered 4 days ago ─────────────────────
    INSERT INTO orders (id, store_id, customer_id, driver_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, v_driver_id, 'delivered',
        25.30, 3.04, 3.50, 31.84, 'paid',
        NOW() - INTERVAL '4 days 3 hours', NOW() - INTERVAL '4 days 1 hour'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[9], 'Avocados (Ripe) 2 pack', 2, 1.99, 0.00, 3.98, true),
        (gen_random_uuid(), v_order_id, v_product_ids[10], 'Smoked Salmon 100g', 1, 4.50, 0.20, 4.50, true),
        (gen_random_uuid(), v_order_id, v_product_ids[3], 'Sourdough Bread Loaf', 2, 2.99, 0.00, 5.98, true),
        (gen_random_uuid(), v_order_id, v_product_ids[5], 'Salted Butter 250g', 2, 2.25, 0.20, 4.50, true),
        (gen_random_uuid(), v_order_id, v_product_ids[6], 'Mature Cheddar 350g', 1, 3.50, 0.20, 3.50, true),
        (gen_random_uuid(), v_order_id, v_product_ids[2], 'Free Range Eggs (6 pack)', 1, 2.29, 0.20, 2.29, true);

    -- ─── Order 4: Delivered 3 days ago ─────────────────────
    INSERT INTO orders (id, store_id, customer_id, driver_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, v_driver_id, 'delivered',
        9.97, 0.00, 3.50, 13.47, 'paid',
        NOW() - INTERVAL '3 days 7 hours', NOW() - INTERVAL '3 days 5 hours'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[7], 'Fairtrade Bananas 5 pack', 1, 0.89, 0.00, 0.89, true),
        (gen_random_uuid(), v_order_id, v_product_ids[8], 'Greek Yogurt 500g', 2, 2.49, 0.20, 4.98, true),
        (gen_random_uuid(), v_order_id, v_product_ids[1], 'Organic Whole Milk 1L', 1, 1.49, 0.00, 1.49, true),
        (gen_random_uuid(), v_order_id, v_product_ids[9], 'Avocados (Ripe) 2 pack', 1, 1.99, 0.00, 1.99, true);

    -- ─── Order 5: Delivered 2 days ago ─────────────────────
    INSERT INTO orders (id, store_id, customer_id, driver_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, v_driver_id, 'delivered',
        31.45, 3.77, 3.50, 38.72, 'paid',
        NOW() - INTERVAL '2 days 5 hours', NOW() - INTERVAL '2 days 3 hours'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[10], 'Smoked Salmon 100g', 2, 4.50, 0.20, 9.00, true),
        (gen_random_uuid(), v_order_id, v_product_ids[6], 'Mature Cheddar 350g', 2, 3.50, 0.20, 7.00, true),
        (gen_random_uuid(), v_order_id, v_product_ids[4], 'British Strawberries 400g', 3, 3.49, 0.20, 10.47, true),
        (gen_random_uuid(), v_order_id, v_product_ids[5], 'Salted Butter 250g', 1, 2.25, 0.20, 2.25, true),
        (gen_random_uuid(), v_order_id, v_product_ids[3], 'Sourdough Bread Loaf', 1, 2.99, 0.00, 2.99, true);

    -- ─── Order 6: Delivered 1 day ago ─────────────────────
    INSERT INTO orders (id, store_id, customer_id, driver_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, v_driver_id, 'delivered',
        15.68, 1.88, 3.50, 21.06, 'paid',
        NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day 6 hours'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[2], 'Free Range Eggs (6 pack)', 2, 2.29, 0.20, 4.58, true),
        (gen_random_uuid(), v_order_id, v_product_ids[8], 'Greek Yogurt 500g', 1, 2.49, 0.20, 2.49, true),
        (gen_random_uuid(), v_order_id, v_product_ids[7], 'Fairtrade Bananas 5 pack', 3, 0.89, 0.00, 2.67, true),
        (gen_random_uuid(), v_order_id, v_product_ids[1], 'Organic Whole Milk 1L', 2, 1.49, 0.00, 2.98, true),
        (gen_random_uuid(), v_order_id, v_product_ids[5], 'Salted Butter 250g', 1, 2.25, 0.20, 2.25, true);

    -- ─── Order 7: Out for delivery TODAY ───────────────────
    INSERT INTO orders (id, store_id, customer_id, driver_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, v_driver_id, 'out_for_delivery',
        22.40, 2.69, 3.50, 28.59, 'paid',
        NOW() - INTERVAL '2 hours', NOW() - INTERVAL '30 minutes'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[3], 'Sourdough Bread Loaf', 1, 2.99, 0.00, 2.99, true),
        (gen_random_uuid(), v_order_id, v_product_ids[6], 'Mature Cheddar 350g', 1, 3.50, 0.20, 3.50, true),
        (gen_random_uuid(), v_order_id, v_product_ids[10], 'Smoked Salmon 100g', 1, 4.50, 0.20, 4.50, true),
        (gen_random_uuid(), v_order_id, v_product_ids[4], 'British Strawberries 400g', 2, 3.49, 0.20, 6.98, true),
        (gen_random_uuid(), v_order_id, v_product_ids[9], 'Avocados (Ripe) 2 pack', 2, 1.99, 0.00, 3.98, true);

    -- ─── Order 8: Picking TODAY ────────────────────────────
    INSERT INTO orders (id, store_id, customer_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, 'picking',
        8.93, 0.60, 3.50, 13.03, 'paid',
        NOW() - INTERVAL '1 hour', NOW() - INTERVAL '15 minutes'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[1], 'Organic Whole Milk 1L', 2, 1.49, 0.00, 2.98, true),
        (gen_random_uuid(), v_order_id, v_product_ids[7], 'Fairtrade Bananas 5 pack', 1, 0.89, 0.00, 0.89, false),
        (gen_random_uuid(), v_order_id, v_product_ids[8], 'Greek Yogurt 500g', 1, 2.49, 0.20, 2.49, false),
        (gen_random_uuid(), v_order_id, v_product_ids[2], 'Free Range Eggs (6 pack)', 1, 2.29, 0.20, 2.29, false);

    -- ─── Order 9: Placed TODAY (pending) ───────────────────
    INSERT INTO orders (id, store_id, customer_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, 'placed',
        14.46, 1.73, 3.50, 19.69, 'paid',
        NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[5], 'Salted Butter 250g', 2, 2.25, 0.20, 4.50, false),
        (gen_random_uuid(), v_order_id, v_product_ids[3], 'Sourdough Bread Loaf', 1, 2.99, 0.00, 2.99, false),
        (gen_random_uuid(), v_order_id, v_product_ids[9], 'Avocados (Ripe) 2 pack', 2, 1.99, 0.00, 3.98, false),
        (gen_random_uuid(), v_order_id, v_product_ids[6], 'Mature Cheddar 350g', 1, 3.50, 0.20, 3.50, false);

    -- ─── Order 10: Confirmed TODAY ─────────────────────────
    INSERT INTO orders (id, store_id, customer_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, 'confirmed',
        19.44, 2.33, 3.50, 25.27, 'paid',
        NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '40 minutes'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[4], 'British Strawberries 400g', 2, 3.49, 0.20, 6.98, false),
        (gen_random_uuid(), v_order_id, v_product_ids[10], 'Smoked Salmon 100g', 1, 4.50, 0.20, 4.50, false),
        (gen_random_uuid(), v_order_id, v_product_ids[8], 'Greek Yogurt 500g', 2, 2.49, 0.20, 4.98, false),
        (gen_random_uuid(), v_order_id, v_product_ids[7], 'Fairtrade Bananas 5 pack', 1, 0.89, 0.00, 0.89, false),
        (gen_random_uuid(), v_order_id, v_product_ids[1], 'Organic Whole Milk 1L', 1, 1.49, 0.00, 1.49, false),
        (gen_random_uuid(), v_order_id, v_product_ids[2], 'Free Range Eggs (6 pack)', 1, 2.29, 0.20, 2.29, false);

    -- ─── Order 11: Ready for pickup ────────────────────────
    INSERT INTO orders (id, store_id, customer_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, 'ready',
        11.22, 1.35, 3.50, 16.07, 'paid',
        NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '50 minutes'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[6], 'Mature Cheddar 350g', 1, 3.50, 0.20, 3.50, true),
        (gen_random_uuid(), v_order_id, v_product_ids[3], 'Sourdough Bread Loaf', 1, 2.99, 0.00, 2.99, true),
        (gen_random_uuid(), v_order_id, v_product_ids[9], 'Avocados (Ripe) 2 pack', 1, 1.99, 0.00, 1.99, true),
        (gen_random_uuid(), v_order_id, v_product_ids[5], 'Salted Butter 250g', 1, 2.25, 0.20, 2.25, true);

    -- ─── Order 12: Cancelled order from yesterday ──────────
    INSERT INTO orders (id, store_id, customer_id, status, subtotal, vat_amount, delivery_fee, total, payment_status, created_at, updated_at)
    VALUES (
        gen_random_uuid(), v_store_id, v_customer_id, 'cancelled',
        7.47, 0.90, 3.50, 11.87, 'refunded',
        NOW() - INTERVAL '1 day 10 hours', NOW() - INTERVAL '1 day 9 hours'
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, vat_rate, subtotal, picked)
    VALUES
        (gen_random_uuid(), v_order_id, v_product_ids[2], 'Free Range Eggs (6 pack)', 1, 2.29, 0.20, 2.29, false),
        (gen_random_uuid(), v_order_id, v_product_ids[7], 'Fairtrade Bananas 5 pack', 1, 0.89, 0.00, 0.89, false),
        (gen_random_uuid(), v_order_id, v_product_ids[1], 'Organic Whole Milk 1L', 1, 1.49, 0.00, 1.49, false),
        (gen_random_uuid(), v_order_id, v_product_ids[5], 'Salted Butter 250g', 1, 2.25, 0.20, 2.25, false);

    -- Also set the driver on duty for the active deliveries
    UPDATE driver_profiles SET is_on_duty = true WHERE user_id = v_driver_id;

    RAISE NOTICE 'Successfully seeded 12 demo orders with order items';
END $$;
