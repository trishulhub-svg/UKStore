/**
 * Applies SQL migration to Supabase using the pg library
 * Requires the SUPABASE_DB_PASSWORD environment variable
 * 
 * Usage: SUPABASE_DB_PASSWORD=your_password node scripts/apply-migration.mjs
 * 
 * If no DB password is available, the script will output the SQL
 * for manual execution in the Supabase SQL Editor.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

async function applyMigration() {
  const sqlFile = path.join(process.cwd(), 'supabase/migrations/00009_missing_tables_and_driver_role.sql');
  const sql = fs.readFileSync(sqlFile, 'utf-8');
  
  if (!DB_PASSWORD) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  SUPABASE_DB_PASSWORD not set                               ║');
    console.log('║                                                              ║');
    console.log('║  Please run the migration SQL manually in the Supabase       ║');
    console.log('║  Dashboard SQL Editor:                                       ║');
    console.log('║                                                              ║');
    console.log('║  1. Go to: https://supabase.com/dashboard                    ║');
    console.log('║  2. Select your project: rkryxwvbnafiolhndcer               ║');
    console.log('║  3. Click "SQL Editor" in the sidebar                        ║');
    console.log('║  4. Click "New Query"                                        ║');
    console.log('║  5. Paste the contents of:                                    ║');
    console.log('║     supabase/migrations/00009_missing_tables_and_driver_role.sql ║');
    console.log('║  6. Click "Run"                                              ║');
    console.log('║                                                              ║');
    console.log('║  Or set SUPABASE_DB_PASSWORD and re-run this script:         ║');
    console.log('║  SUPABASE_DB_PASSWORD=xxx node scripts/apply-migration.mjs  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    process.exit(0);
  }
  
  // Construct connection string
  const connectionString = `postgresql://postgres.rkryxwvbnafiolhndcer:${DB_PASSWORD}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`;
  
  console.log('Connecting to Supabase PostgreSQL...');
  
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected! Applying migration...');
    
    await client.query(sql);
    console.log('Migration applied successfully!');
    
    // Verify tables
    const tables = ['store_settings', 'favourites', 'notifications', 'driver_profiles', 'delivery_zones', 'promotions'];
    for (const table of tables) {
      const result = await client.query(`SELECT count(*) FROM ${table}`);
      console.log(`  ${table}: ${result.rows[0].count} rows`);
    }
    
  } catch (err) {
    console.error('Migration failed:', err.message);
    
    // Try direct connection (non-pooler)
    console.log('\nTrying direct connection...');
    const directConnStr = `postgresql://postgres:${DB_PASSWORD}@db.rkryxwvbnafiolhndcer.supabase.co:5432/postgres`;
    const client2 = new pg.Client({
      connectionString: directConnStr,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await client2.connect();
      console.log('Direct connection successful! Applying migration...');
      await client2.query(sql);
      console.log('Migration applied successfully!');
      await client2.end();
    } catch (err2) {
      console.error('Direct connection also failed:', err2.message);
      console.log('\nPlease run the migration SQL manually in the Supabase Dashboard SQL Editor.');
      process.exit(1);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

applyMigration();
