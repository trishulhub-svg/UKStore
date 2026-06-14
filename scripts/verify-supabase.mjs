#!/usr/bin/env node
/**
 * Fresh Mart London - Supabase Connectivity Verification
 * 
 * Run this after setup to verify everything is working.
 * 
 * Usage:
 *   node scripts/verify-supabase.mjs
 *   (reads from .env file automatically)
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const ENV_FILE = join(ROOT_DIR, '.env');

// Parse .env file
function parseEnv() {
  const content = readFileSync(ENV_FILE, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        env[key] = value;
      }
    }
  }
  return env;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Fresh Mart London - Supabase Verification           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const env = parseEnv();
  
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  // Check env vars exist
  console.log('1. Checking environment variables...');
  if (!supabaseUrl || supabaseUrl.includes('YOUR_PROJECT_REF')) {
    console.log('   ❌ NEXT_PUBLIC_SUPABASE_URL not set (still has placeholder)');
    console.log('   Run: node scripts/setup-supabase.mjs --token <your-token>');
    process.exit(1);
  }
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_URL = ${supabaseUrl}`);
  
  if (!anonKey || anonKey === 'your-anon-key-here') {
    console.log('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
    process.exit(1);
  }
  console.log(`   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY = ${anonKey.substring(0, 20)}...`);
  
  if (!serviceRoleKey || serviceRoleKey === 'your-service-role-key-here') {
    console.log('   ❌ SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
  }
  console.log(`   ✅ SUPABASE_SERVICE_ROLE_KEY = ${serviceRoleKey.substring(0, 20)}...`);

  // Test REST API with anon key
  console.log('\n2. Testing REST API (anon key)...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/stores?select=id,name,slug,is_active&limit=5`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });
    
    if (response.ok) {
      const stores = await response.json();
      console.log(`   ✅ Connected! Found ${stores.length} store(s)`);
      for (const store of stores) {
        console.log(`      - ${store.name} (${store.slug}) active=${store.is_active}`);
      }
    } else {
      const text = await response.text();
      console.log(`   ❌ API returned ${response.status}: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error.message}`);
    console.log('   Check that your project is active and the URL is correct.');
  }

  // Test categories
  console.log('\n3. Testing categories...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/categories?select=name,slug,sort_order&limit=10`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });
    
    if (response.ok) {
      const categories = await response.json();
      console.log(`   ✅ Found ${categories.length} categories`);
      for (const cat of categories) {
        console.log(`      ${cat.sort_order}. ${cat.name} (${cat.slug})`);
      }
    } else {
      console.log(`   ❌ API returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test products
  console.log('\n4. Testing products...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/products?select=name,price,is_available,is_featured&limit=5`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });
    
    if (response.ok) {
      const products = await response.json();
      console.log(`   ✅ Found ${products.length} products (showing first 5)`);
      for (const p of products) {
        const feat = p.is_featured ? '⭐' : '  ';
        const avail = p.is_available ? '✓' : '✗';
        console.log(`      ${feat} £${p.price.toFixed(2)} [${avail}] ${p.name}`);
      }
    } else {
      console.log(`   ❌ API returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test auth endpoint
  console.log('\n5. Testing auth endpoint...');
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        'apikey': anonKey,
      },
    });
    
    if (response.ok) {
      const settings = await response.json();
      console.log(`   ✅ Auth endpoint reachable`);
      console.log(`      Signup enabled: ${settings.enable_signup}`);
    } else {
      console.log(`   ⚠️  Auth returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              Verification Complete!                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
