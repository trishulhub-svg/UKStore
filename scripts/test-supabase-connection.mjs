import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rkryxwvbnafiolhndcer.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcnl4d3ZibmFmaW9saG5kY2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgxODIxMiwiZXhwIjoyMDk2Mzk0MjEyfQ.JV3_20u7xi2WZc5mVzhrEkef8M_uLNPqExx6_yi9jDo';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testConnection() {
  console.log('=== Supabase Connection Test ===\n');

  // Test 1: Check if stores table exists and has data
  console.log('1. Testing stores table...');
  const { data: stores, error: storesError } = await supabase.from('stores').select('*').limit(5);
  if (storesError) {
    console.log('   ❌ Error:', storesError.message);
  } else {
    console.log(`   ✅ Found ${stores.length} store(s)`);
    stores.forEach(s => console.log(`      - ${s.name} (${s.id})`));
  }

  // Test 2: Check categories
  console.log('\n2. Testing categories table...');
  const { data: categories, error: catError } = await supabase.from('categories').select('*').limit(10);
  if (catError) {
    console.log('   ❌ Error:', catError.message);
  } else {
    console.log(`   ✅ Found ${categories.length} categories`);
  }

  // Test 3: Check products
  console.log('\n3. Testing products table...');
  const { data: products, error: prodError } = await supabase.from('products').select('*').limit(5);
  if (prodError) {
    console.log('   ❌ Error:', prodError.message);
  } else {
    console.log(`   ✅ Found ${products.length} product(s) (showing first 5)`);
    products.forEach(p => console.log(`      - ${p.name} (£${p.price})`));
  }

  // Test 4: Check profiles
  console.log('\n4. Testing profiles table...');
  const { data: profiles, error: profError } = await supabase.from('profiles').select('*').limit(5);
  if (profError) {
    console.log('   ❌ Error:', profError.message);
  } else {
    console.log(`   ✅ Found ${profiles.length} profile(s)`);
    profiles.forEach(p => console.log(`      - ${p.email} (${p.role})`));
  }

  // Test 5: Check addresses
  console.log('\n5. Testing addresses table...');
  const { data: addresses, error: addrError } = await supabase.from('addresses').select('*').limit(5);
  if (addrError) {
    console.log('   ❌ Error:', addrError.message);
  } else {
    console.log(`   ✅ Found ${addresses.length} address(es)`);
  }

  // Test 6: Check orders
  console.log('\n6. Testing orders table...');
  const { data: orders, error: ordError } = await supabase.from('orders').select('*').limit(5);
  if (ordError) {
    console.log('   ❌ Error:', ordError.message);
  } else {
    console.log(`   ✅ Found ${orders.length} order(s)`);
  }

  // Test 7: Check order_items
  console.log('\n7. Testing order_items table...');
  const { data: orderItems, error: oiError } = await supabase.from('order_items').select('*').limit(5);
  if (oiError) {
    console.log('   ❌ Error:', oiError.message);
  } else {
    console.log(`   ✅ Found ${orderItems.length} order item(s)`);
  }

  // Test 8: Check rider_verifications
  console.log('\n8. Testing rider_verifications table...');
  const { data: rv, error: rvError } = await supabase.from('rider_verifications').select('*').limit(5);
  if (rvError) {
    console.log('   ❌ Error:', rvError.message);
  } else {
    console.log(`   ✅ Found ${rv.length} rider verification(s)`);
  }

  // Test 9: Check if missing tables exist (favourites, notifications, driver_profiles, delivery_zones, promotions)
  console.log('\n9. Testing additional tables...');
  const extraTables = ['favourites', 'notifications', 'driver_profiles', 'delivery_zones', 'promotions', 'store_settings'];
  for (const table of extraTables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`   ❌ ${table}: ${error.message.includes('does not exist') ? 'MISSING' : error.message}`);
    } else {
      console.log(`   ✅ ${table}: exists`);
    }
  }

  console.log('\n=== Connection Test Complete ===');
}

testConnection().catch(console.error);
