import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rkryxwvbnafiolhndcer.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcnl4d3ZibmFmaW9saG5kY2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgxODIxMiwiZXhwIjoyMDk2Mzk0MjEyfQ.JV3_20u7xi2WZc5mVzhrEkef8M_uLNPqExx6_yi9jDo';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seedAdmin() {
  console.log('=== Seeding Admin Account (v2 - admin API) ===\n');

  // Step 1: Check if profiles table is accessible
  console.log('1. Checking profiles table...');
  const { data: profiles, error: profError } = await supabase.from('profiles').select('*').limit(5);
  if (profError) {
    console.log('   ❌ Error accessing profiles:', profError.message);
  } else {
    console.log('   ✅ Profiles table accessible, current rows:', profiles.length);
  }

  // Step 2: Check existing auth users
  console.log('\n2. Listing existing auth users...');
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.log('   ❌ Error listing users:', listError.message);
  } else {
    console.log(`   Found ${users.length} existing user(s):`);
    users.forEach(u => console.log(`   - ${u.email} (${u.id}) - created: ${u.created_at}`));
  }

  // Step 3: Try creating admin user via admin API (bypasses trigger)
  console.log('\n3. Creating admin user via admin API...');
  const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
    email: 'admin@freshmart.co.uk',
    password: 'Admin@2026',
    email_confirm: true,
    user_metadata: {
      full_name: 'Admin User',
      role: 'owner',
    },
  });

  if (adminError) {
    console.log('   ❌ Error:', adminError.message);
  } else if (adminData.user) {
    console.log('   ✅ Admin user created:', adminData.user.id);
    
    // Manually create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: adminData.user.id,
        store_id: 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
        email: 'admin@freshmart.co.uk',
        full_name: 'Admin User',
        role: 'owner',
      });
    
    if (profileError) {
      console.log('   ❌ Profile error:', profileError.message);
    } else {
      console.log('   ✅ Admin profile created');
    }
  }

  // Step 4: Create customer user
  console.log('\n4. Creating customer user...');
  const { data: customerData, error: customerError } = await supabase.auth.admin.createUser({
    email: 'customer@freshmart.co.uk',
    password: 'Customer@2026',
    email_confirm: true,
    user_metadata: {
      full_name: 'Test Customer',
      role: 'customer',
    },
  });

  if (customerError) {
    if (customerError.message.includes('already')) {
      console.log('   Already exists');
    } else {
      console.log('   ❌ Error:', customerError.message);
    }
  } else if (customerData.user) {
    console.log('   ✅ Customer created:', customerData.user.id);
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: customerData.user.id,
        store_id: 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
        email: 'customer@freshmart.co.uk',
        full_name: 'Test Customer',
        role: 'customer',
      });
    
    if (profileError) {
      console.log('   ❌ Profile error:', profileError.message);
    } else {
      console.log('   ✅ Customer profile created');
    }
  }

  // Step 5: Create driver user
  console.log('\n5. Creating driver user...');
  const { data: driverData, error: driverError } = await supabase.auth.admin.createUser({
    email: 'driver@freshmart.co.uk',
    password: 'Driver@2026',
    email_confirm: true,
    user_metadata: {
      full_name: 'Test Driver',
      role: 'driver',
    },
  });

  if (driverError) {
    if (driverError.message.includes('already')) {
      console.log('   Already exists');
    } else {
      console.log('   ❌ Error:', driverError.message);
    }
  } else if (driverData.user) {
    console.log('   ✅ Driver created:', driverData.user.id);
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: driverData.user.id,
        store_id: 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
        email: 'driver@freshmart.co.uk',
        full_name: 'Test Driver',
        role: 'driver',
      });
    
    if (profileError) {
      console.log('   ❌ Profile error:', profileError.message);
    } else {
      console.log('   ✅ Driver profile created');
    }
    
    // Try to create driver_profiles entry (may fail if table doesn't exist)
    const { error: dpError } = await supabase
      .from('driver_profiles')
      .upsert({
        user_id: driverData.user.id,
        vehicle_type: 'bicycle',
        verification_status: 'approved',
      });
    
    if (dpError) {
      console.log('   ⚠️ Driver profile table not yet created:', dpError.message.substring(0, 80));
    } else {
      console.log('   ✅ Driver profile details created');
    }
  }

  // Step 6: Summary
  console.log('\n=== Final Summary ===');
  const { data: allProfiles } = await supabase.from('profiles').select('email, role');
  if (allProfiles && allProfiles.length > 0) {
    console.log('All profiles:');
    allProfiles.forEach(p => console.log(`  - ${p.email} (${p.role})`));
  } else {
    console.log('No profiles found');
  }

  const { data: storeCount } = await supabase.from('stores').select('*', { count: 'exact', head: true });
  const { data: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  const { data: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  console.log(`\nData: ${storeCount ? 1 : 0} store, ${catCount || 0} categories, ${prodCount || 0} products`);
  
  console.log('\n=== Login Credentials ===');
  console.log('Admin:    admin@freshmart.co.uk / Admin@2026');
  console.log('Customer: customer@freshmart.co.uk / Customer@2026');
  console.log('Driver:   driver@freshmart.co.uk / Driver@2026');
}

seedAdmin().catch(console.error);
