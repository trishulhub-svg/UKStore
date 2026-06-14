import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rkryxwvbnafiolhndcer.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcnl4d3ZibmFmaW9saG5kY2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgxODIxMiwiZXhwIjoyMDk2Mzk0MjEyfQ.JV3_20u7xi2WZc5mVzhrEkef8M_uLNPqExx6_yi9jDo';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function diagnose() {
  console.log('=== Diagnosing Auth Issues ===\n');

  // 1. Check if store data exists
  console.log('1. Checking stores...');
  const { data: stores, error: storeError, count: storeCount } = await supabase
    .from('stores')
    .select('*', { count: 'exact' })
    .limit(1);
  console.log(`   Stores: ${storeCount} row(s), data: ${stores?.length || 0}`);
  if (stores?.length > 0) {
    console.log(`   First store: ${stores[0].name} (${stores[0].id})`);
  }

  // 2. Check if categories exist
  const { count: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
  console.log(`   Categories: ${catCount}`);

  // 3. Check if products exist
  const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  console.log(`   Products: ${prodCount}`);

  // 4. Try inserting into profiles table directly
  console.log('\n2. Testing profile insert...');
  const testProfile = {
    id: '00000000-0000-0000-0000-000000000001',
    store_id: 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
    email: 'test-diagnostic@freshmart.co.uk',
    full_name: 'Diagnostic Test',
    role: 'customer',
  };
  
  const { data: insertData, error: insertError } = await supabase
    .from('profiles')
    .insert(testProfile)
    .select();
  
  if (insertError) {
    console.log('   ❌ Insert error:', insertError.message);
    console.log('   Details:', insertError.details);
    console.log('   Code:', insertError.code);
  } else {
    console.log('   ✅ Insert successful:', insertData);
    // Clean up
    await supabase.from('profiles').delete().eq('id', testProfile.id);
    console.log('   Cleaned up test profile');
  }

  // 5. Try profile insert with NULL store_id
  console.log('\n3. Testing profile insert with NULL store_id...');
  const testProfile2 = {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'test-null-store@freshmart.co.uk',
    full_name: 'Null Store Test',
    role: 'customer',
    // store_id intentionally omitted
  };
  
  const { data: insertData2, error: insertError2 } = await supabase
    .from('profiles')
    .insert(testProfile2)
    .select();
  
  if (insertError2) {
    console.log('   ❌ Insert error:', insertError2.message);
    console.log('   Details:', insertError2.details);
  } else {
    console.log('   ✅ Insert with null store_id successful:', insertData2);
    await supabase.from('profiles').delete().eq('id', testProfile2.id);
    console.log('   Cleaned up test profile');
  }

  // 6. Try creating user via admin API with more details
  console.log('\n4. Creating test user via admin API...');
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: 'test-create@freshmart.co.uk',
    password: 'TestPass@2026',
    email_confirm: true,
    app_metadata: {
      role: 'customer',
    },
    user_metadata: {
      full_name: 'API Test User',
    },
  });

  if (userError) {
    console.log('   ❌ Admin create user error:', userError.message);
    console.log('   Status:', userError.status);
    console.log('   Code:', userError.code);
  } else if (userData.user) {
    console.log('   ✅ User created:', userData.user.id);
    
    // Check if profile was auto-created
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();
    
    if (profile) {
      console.log('   ✅ Profile auto-created:', profile.email, profile.role);
    } else {
      console.log('   ⚠️ Profile not auto-created, creating manually...');
      const { error: mpError } = await supabase
        .from('profiles')
        .insert({
          id: userData.user.id,
          store_id: 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
          email: 'test-create@freshmart.co.uk',
          full_name: 'API Test User',
          role: 'customer',
        });
      
      if (mpError) {
        console.log('   ❌ Manual profile error:', mpError.message);
      } else {
        console.log('   ✅ Profile created manually');
      }
    }
    
    // Clean up
    await supabase.auth.admin.deleteUser(userData.user.id);
    console.log('   Cleaned up test user');
  }
}

diagnose().catch(console.error);
