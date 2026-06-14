#!/usr/bin/env node
/**
 * ============================================================
 * Fresh Mart London - Supabase Project Setup Script
 * ============================================================
 * 
 * This script automates the complete Supabase project setup:
 *   1. Creates a new Supabase project via the Management API
 *   2. Waits for provisioning to complete
 *   3. Extracts project URL, anon key, and service role key
 *   4. Appends env vars to .env file
 *   5. Runs all 8 migration files in order
 *   6. Runs the seed file
 *   7. Verifies connectivity with a simple query
 *
 * PREREQUISITES:
 *   - Node.js 18+ 
 *   - A Supabase access token (get one from https://supabase.com/dashboard/account/tokens)
 *   - Set SUPABASE_ACCESS_TOKEN env var OR pass it as --token argument
 *
 * USAGE:
 *   node scripts/setup-supabase.mjs --token sbp_your_token_here
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/setup-supabase.mjs
 *   node scripts/setup-supabase.mjs --token sbp_xxx --db-pass YourDbPassword123
 *
 * ============================================================
 */

import { readFileSync, appendFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Configuration ────────────────────────────────────────────────
const PROJECT_NAME = 'Fresh Mart London';
const PROJECT_REGION = 'eu-west-2'; // London
const PROJECT_PLAN = 'free';
const DB_PASSWORD_DEFAULT = 'FreshMart2026!Secure';
const MAX_PROVISION_WAIT_MINUTES = 10;
const POLL_INTERVAL_SECONDS = 15;

// ── Paths ────────────────────────────────────────────────────────
const ROOT_DIR = resolve(__dirname, '..');
const ENV_FILE = join(ROOT_DIR, '.env');
const MIGRATIONS_DIR = join(ROOT_DIR, 'supabase', 'migrations');
const SEED_FILE = join(ROOT_DIR, 'supabase', 'seed', 'seed.sql');

const MIGRATION_FILES = [
  '00001_initial_schema.sql',
  '00002_rls_policies.sql',
  '00003_auth_trigger.sql',
  '00004_store_settings.sql',
  '00005_profiles_nullable_store.sql',
  '00006_fix_auth_schema.sql',
  '00007_bootstrap_full_schema.sql',
  '00008_urgent_fix_registration.sql',
];

// ── Parse CLI args ───────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token' && args[i + 1]) {
      parsed.token = args[++i];
    } else if (args[i] === '--db-pass' && args[i + 1]) {
      parsed.dbPassword = args[++i];
    } else if (args[i] === '--project-name' && args[i + 1]) {
      parsed.projectName = args[++i];
    } else if (args[i] === '--skip-migrations') {
      parsed.skipMigrations = true;
    } else if (args[i] === '--skip-seed') {
      parsed.skipSeed = true;
    } else if (args[i] === '--help') {
      parsed.help = true;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`
Fresh Mart London - Supabase Project Setup

Usage:
  node scripts/setup-supabase.mjs --token <your-supabase-access-token> [options]

Options:
  --token           Supabase access token (required, or set SUPABASE_ACCESS_TOKEN)
  --db-pass         Database password (default: ${DB_PASSWORD_DEFAULT})
  --project-name    Project name (default: ${PROJECT_NAME})
  --skip-migrations Skip running migration files
  --skip-seed       Skip running seed file
  --help            Show this help message

Get your access token at: https://supabase.com/dashboard/account/tokens
  `);
}

// ── API helpers ──────────────────────────────────────────────────
async function supabaseApi(method, path, body = null, token) {
  const url = `https://api.supabase.com/v1${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

// ── Step 1: Create project ──────────────────────────────────────
async function createProject(token, dbPassword, projectName) {
  console.log(`\n📦 Creating Supabase project: "${projectName}" in region ${PROJECT_REGION}...`);
  
  const project = await supabaseApi('POST', '/projects', {
    name: projectName,
    region: PROJECT_REGION,
    plan: PROJECT_PLAN,
    db_pass: dbPassword,
  }, token);

  console.log(`   ✅ Project creation initiated!`);
  console.log(`   Project ID: ${project.id}`);
  console.log(`   Ref: ${project.ref}`);
  console.log(`   Status: ${project.status}`);

  return project;
}

// ── Step 2: Wait for provisioning ───────────────────────────────
async function waitForProvisioning(projectRef, token) {
  console.log(`\n⏳ Waiting for project to finish provisioning (max ${MAX_PROVISION_WAIT_MINUTES} min)...`);
  
  const maxAttempts = Math.ceil((MAX_PROVISION_WAIT_MINUTES * 60) / POLL_INTERVAL_SECONDS);
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      const projects = await supabaseApi('GET', '/projects', null, token);
      const project = projects.find(p => p.ref === projectRef);
      
      if (project) {
        console.log(`   [${attempts}/${maxAttempts}] Status: ${project.status}`);
        
        if (project.status === 'active') {
          console.log(`   ✅ Project is active and ready!`);
          return project;
        }
        
        if (project.status === 'paused') {
          console.log(`   ⚠️  Project is paused. Attempting to restore...`);
          try {
            await supabaseApi('POST', `/projects/${projectRef}/restore`, null, token);
          } catch (e) {
            console.log(`   Could not auto-restore: ${e.message}`);
          }
        }
        
        if (project.status === 'failed') {
          throw new Error('Project provisioning failed!');
        }
      }
    } catch (error) {
      if (error.message.includes('401')) {
        throw new Error('Authentication failed. Check your access token.');
      }
      console.log(`   [${attempts}/${maxAttempts}] Polling... (${error.message})`);
    }
    
    await new Promise(r => setTimeout(r, POLL_INTERVAL_SECONDS * 1000));
  }
  
  throw new Error(`Project did not become active within ${MAX_PROVISION_WAIT_MINUTES} minutes.`);
}

// ── Step 3: Get API keys ────────────────────────────────────────
async function getApiKeys(projectRef, token) {
  console.log(`\n🔑 Fetching API keys...`);
  
  const keys = await supabaseApi('GET', `/projects/${projectRef}/api-keys`, null, token);
  
  const anonKey = keys.find(k => k.name === 'anon')?.api_key;
  const serviceRoleKey = keys.find(k => k.name === 'service_role')?.api_key;
  
  if (!anonKey || !serviceRoleKey) {
    throw new Error(`Could not find API keys. Available keys: ${keys.map(k => k.name).join(', ')}`);
  }
  
  const projectUrl = `https://${projectRef}.supabase.co`;
  
  console.log(`   ✅ Got API keys!`);
  console.log(`   URL: ${projectUrl}`);
  console.log(`   Anon Key: ${anonKey.substring(0, 20)}...`);
  console.log(`   Service Role Key: ${serviceRoleKey.substring(0, 20)}...`);
  
  return { projectUrl, anonKey, serviceRoleKey };
}

// ── Step 4: Update .env file ────────────────────────────────────
function updateEnvFile(projectUrl, anonKey, serviceRoleKey) {
  console.log(`\n📝 Updating .env file...`);
  
  const envVars = `
# ── Supabase Configuration (auto-added by setup script) ──
NEXT_PUBLIC_SUPABASE_URL=${projectUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}
`;

  appendFileSync(ENV_FILE, envVars, 'utf8');
  console.log(`   ✅ Environment variables appended to ${ENV_FILE}`);
}

// ── Step 5: Run SQL via Management API ──────────────────────────
async function runSql(projectRef, token, sql, label) {
  console.log(`   Running: ${label}...`);
  
  const result = await supabaseApi('POST', `/projects/${projectRef}/database/query`, {
    query: sql,
  }, token);
  
  if (result.error) {
    console.log(`   ⚠️  Warning in ${label}: ${result.error.message || JSON.stringify(result.error)}`);
  } else {
    console.log(`   ✅ ${label} - OK`);
  }
  
  return result;
}

async function runMigrations(projectRef, token) {
  console.log(`\n🗂️  Running 8 migration files...`);
  
  for (const file of MIGRATION_FILES) {
    const filePath = join(MIGRATIONS_DIR, file);
    if (!existsSync(filePath)) {
      console.log(`   ⚠️  Migration file not found: ${file} - skipping`);
      continue;
    }
    const sql = readFileSync(filePath, 'utf8');
    await runSql(projectRef, token, sql, file);
  }
}

async function runSeed(projectRef, token) {
  console.log(`\n🌱 Running seed file...`);
  
  if (!existsSync(SEED_FILE)) {
    console.log(`   ⚠️  Seed file not found: ${SEED_FILE} - skipping`);
    return;
  }
  
  const sql = readFileSync(SEED_FILE, 'utf8');
  await runSql(projectRef, token, sql, 'seed.sql');
}

// ── Step 6: Verify connectivity ─────────────────────────────────
async function verifyConnectivity(projectRef, token, projectUrl, anonKey) {
  console.log(`\n🔍 Verifying database connectivity...`);
  
  // Try the REST API
  try {
    const response = await fetch(`${projectUrl}/rest/v1/stores?select=id,name&limit=5`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });
    
    if (response.ok) {
      const stores = await response.json();
      console.log(`   ✅ REST API is working! Found ${stores.length} store(s).`);
      if (stores.length > 0) {
        console.log(`   Store: ${stores[0].name}`);
      }
    } else {
      const text = await response.text();
      console.log(`   ⚠️  REST API returned ${response.status}: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ⚠️  REST API test failed: ${error.message}`);
  }
  
  // Try a SQL query via Management API
  try {
    const result = await supabaseApi('POST', `/projects/${projectRef}/database/query`, {
      query: `SELECT count(*) as store_count FROM stores; SELECT count(*) as category_count FROM categories; SELECT count(*) as product_count FROM products;`,
    }, token);
    
    console.log(`   ✅ Direct SQL query succeeded!`);
    if (result) {
      console.log(`   Results: ${JSON.stringify(result).substring(0, 300)}`);
    }
  } catch (error) {
    console.log(`   ⚠️  SQL verification query failed: ${error.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  
  const token = args.token || process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error(`
❌ ERROR: No Supabase access token provided!

Get your token at: https://supabase.com/dashboard/account/tokens

Then run:
  node scripts/setup-supabase.mjs --token sbp_your_token_here
  
Or set the environment variable:
  export SUPABASE_ACCESS_TOKEN=sbp_your_token_here
    `);
    process.exit(1);
  }
  
  const dbPassword = args.dbPassword || DB_PASSWORD_DEFAULT;
  const projectName = args.projectName || PROJECT_NAME;
  
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Fresh Mart London - Supabase Project Setup          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Project Name : ${projectName}`);
  console.log(`  Region       : ${PROJECT_REGION} (London)`);
  console.log(`  Plan         : ${PROJECT_PLAN}`);
  console.log(`  DB Password  : ${'*'.repeat(dbPassword.length)}`);
  
  try {
    // Step 1: Create project
    const project = await createProject(token, dbPassword, projectName);
    const projectRef = project.ref;
    
    // Step 2: Wait for provisioning
    await waitForProvisioning(projectRef, token);
    
    // Wait a bit more for the database to be fully ready
    console.log('\n   Waiting 30s for database to stabilize...');
    await new Promise(r => setTimeout(r, 30000));
    
    // Step 3: Get API keys
    const { projectUrl, anonKey, serviceRoleKey } = await getApiKeys(projectRef, token);
    
    // Step 4: Update .env
    updateEnvFile(projectUrl, anonKey, serviceRoleKey);
    
    // Step 5: Run migrations
    if (!args.skipMigrations) {
      await runMigrations(projectRef, token);
    } else {
      console.log('\n⏭️  Skipping migrations (--skip-migrations flag)');
    }
    
    // Step 6: Run seed
    if (!args.skipSeed) {
      await runSeed(projectRef, token);
    } else {
      console.log('\n⏭️  Skipping seed (--skip-seed flag)');
    }
    
    // Step 7: Verify
    await verifyConnectivity(projectRef, token, projectUrl, anonKey);
    
    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              ✅ SETUP COMPLETE!                         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\n  Project URL : ${projectUrl}`);
    console.log(`  Dashboard   : https://supabase.com/dashboard/project/${projectRef}`);
    console.log(`  Env File    : ${ENV_FILE}`);
    console.log('\n  Add these to Vercel/your hosting platform:');
    console.log(`  NEXT_PUBLIC_SUPABASE_URL=${projectUrl}`);
    console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`);
    console.log(`  SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
    console.log('\n  Next steps:');
    console.log('  1. Configure auth providers at: Authentication → Providers');
    console.log('  2. Enable Google OAuth if needed');
    console.log('  3. Deploy your app and test registration/login');
    
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    console.error('\nIf project creation succeeded but later steps failed,');
    console.error('check your Supabase dashboard for the project and run');
    console.error('migrations manually via the SQL Editor.');
    process.exit(1);
  }
}

main();
