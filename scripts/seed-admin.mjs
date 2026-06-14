import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rkryxwvbnafiolhndcer.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcnl4d3ZibmFmaW9saG5kY2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDgxODIxMiwiZXhwIjoyMDk2Mzk0MjEyfQ.JV3_20u7xi2WZc5mVzhrEkef8M_uLNPqExx6_yi9jDo';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seedAdmin() {
  console.log('=== Seeding Admin Account ===\n');

  // 1. Create admin user in Supabase Auth
  console.log('1. Creating admin user in Supabase Auth...');
  const { data: adminAuth, error: adminError } = await supabase.auth.signUp({
    email: 'admin@freshmart.co.uk',
    password: 'Admin@2026',
    options: {
      data: {
        full_name: 'Admin User',
        role: 'owner',
      },
      emailConfirm: true,
    },
  });

  if (adminError) {
    if (adminError.message.includes('already registered') || adminError.message.includes('already been registered')) {
      console.log('   Admin user already exists in Auth. Checking profile...');
      
      // Try to sign in to get the user ID
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'admin@freshmart.co.uk',
        password: 'Admin@2026',
      });
      
      if (signInData?.user) {
        console.log('   Admin user ID:', signInData.user.id);
        
        // Check if profile exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', signInData.user.id)
          .single();
        
        if (profile) {
          console.log('   Profile exists:', profile.email, profile.role);
          
          // Update role to owner if needed
          if (profile.role !== 'owner') {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ role: 'owner', full_name: 'Admin User' })
              .eq('id', signInData.user.id);
            
            if (updateError) {
              console.log('   Failed to update role:', updateError.message);
            } else {
              console.log('   Updated role to owner');
            }
          }
        } else {
          // Create profile manually
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: signInData.user.id,
              store_id: 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
              email: 'admin@freshmart.co.uk',
              full_name: 'Admin User',
              role: 'owner',
            });
          
          if (profileError) {
            console.log('   Failed to create profile:', profileError.message);
          } else {
            console.log('   Created admin profile');
          }
        }
      } else {
        console.log('   Could not sign in as admin. Password may have changed.');
      }
    } else {
      console.log('   Error creating admin:', adminError.message);
    }
  } else if (adminAuth.user) {
    console.log('   Admin user created:', adminAuth.user.id);
    
    // Wait for trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminAuth.user.id)
      .single();
    
    if (profile) {
      console.log('   Profile auto-created:', profile.email, profile.role);
      
      // Update to owner role if trigger set it to customer
      if (profile.role !== 'owner') {
        await supabase
          .from('profiles')
          .update({ role: 'owner' })
          .eq('id', adminAuth.user.id);
        console.log('   Updated role to owner');
      }
    } else {
      // Create profile manually
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: adminAuth.user.id,
          store_id: 'a1b2c3d4-e5f6-4a90-bcd1-ef1234567890',
          email: 'admin@freshmart.co.uk',
          full_name: 'Admin User',
          role: 'owner',
        });
      
      if (profileError) {
        console.log('   Failed to create profile:', profileError.message);
      } else {
        console.log('   Created admin profile manually');
      }
    }
  }

  // 2. Create a test customer
  console.log('\n2. Creating test customer...');
  const { data: customerAuth, error: customerError } = await supabase.auth.signUp({
    email: 'customer@freshmart.co.uk',
    password: 'Customer@2026',
    options: {
      data: {
        full_name: 'Test Customer',
        role: 'customer',
      },
      emailConfirm: true,
    },
  });

  if (customerError) {
    if (customerError.message.includes('already registered')) {
      console.log('   Customer user already exists.');
    } else {
      console.log('   Error:', customerError.message);
    }
  } else if (customerAuth.user) {
    console.log('   Customer user created:', customerAuth.user.id);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', customerAuth.user.id)
      .single();
    
    if (profile) {
      console.log('   Profile auto-created:', profile.email, profile.role);
    }
  }

  // 3. Create a test driver
  console.log('\n3. Creating test driver...');
  const { data: driverAuth, error: driverError } = await supabase.auth.signUp({
    email: 'driver@freshmart.co.uk',
    password: 'Driver@2026',
    options: {
      data: {
        full_name: 'Test Driver',
        role: 'driver',
      },
      emailConfirm: true,
    },
  });

  if (driverError) {
    if (driverError.message.includes('already registered')) {
      console.log('   Driver user already exists.');
    } else {
      console.log('   Error:', driverError.message);
    }
  } else if (driverAuth.user) {
    console.log('   Driver user created:', driverAuth.user.id);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check profile and create driver profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', driverAuth.user.id)
      .single();
    
    if (profile) {
      console.log('   Profile:', profile.email, profile.role);
    }
    
    // Create driver profile
    const { error: dpError } = await supabase
      .from('driver_profiles')
      .insert({
        user_id: driverAuth.user.id,
        vehicle_type: 'bicycle',
        verification_status: 'approved',
      });
    
    if (dpError && !dpError.message.includes('already exists') && !dpError.message.includes('duplicate')) {
      console.log('   Note: Could not create driver_profiles entry (table may not exist yet):', dpError.message);
    } else if (!dpError) {
      console.log('   Driver profile created');
    }
  }

  // 4. Summary
  console.log('\n=== Seed Summary ===');
  const { data: allProfiles } = await supabase.from('profiles').select('email, role');
  console.log('All profiles:');
  allProfiles?.forEach(p => console.log(`  - ${p.email} (${p.role})`));
  
  console.log('\n=== Login Credentials ===');
  console.log('Admin:    admin@freshmart.co.uk / Admin@2026');
  console.log('Customer: customer@freshmart.co.uk / Customer@2026');
  console.log('Driver:   driver@freshmart.co.uk / Driver@2026');
}

seedAdmin().catch(console.error);
