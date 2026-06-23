#!/usr/bin/env node
// ============================================================
// Turso schema migration script.
//
// Uses @libsql/client directly (bypasses Prisma CLI's URL validation
// which strictly enforces `file:` protocol for sqlite provider).
//
// Reads prisma/schema.sql, executes each statement against Turso.
// Idempotent — safe to re-run.
//
// Usage:
//   node scripts/turso-migrate.mjs
//
// Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env
// ============================================================

import { config } from 'dotenv'
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

config()

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..')

const TURSO_URL = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set in .env')
  process.exit(1)
}

const schemaPath = resolve(projectRoot, 'prisma', 'schema.sql')
const schemaSql = readFileSync(schemaPath, 'utf8')

// Split on semicolons that are at the end of a line (avoid splitting
// semicolons inside string literals — none in this schema).
const statements = schemaSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)

console.log('══════════════════════════════════════════════════════════')
console.log('  Turso Schema Migration')
console.log('══════════════════════════════════════════════════════════')
console.log(`  Target:     ${TURSO_URL}`)
console.log(`  Token:      ${TURSO_TOKEN.substring(0, 12)}...`)
console.log(`  Schema:     ${schemaPath}`)
console.log(`  Statements: ${statements.length}`)
console.log('══════════════════════════════════════════════════════════')

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
})

let succeeded = 0
let failed = 0
const failures = []

for (const stmt of statements) {
  try {
    await client.execute(stmt)
    succeeded++
  } catch (err) {
    // Many "already exists" errors are expected — only fail on real errors
    const msg = err.message || String(err)
    if (msg.includes('already exists') || msg.includes('duplicate column')) {
      // Idempotent — ignore
      succeeded++
    } else {
      failed++
      failures.push({ stmt: stmt.substring(0, 80), error: msg })
      console.error(`✗ ${stmt.substring(0, 80).replace(/\n/g, ' ')}...`)
      console.error(`  → ${msg}`)
    }
  }
}

console.log(`\n✓ ${succeeded} statements executed successfully`)
if (failed > 0) {
  console.error(`✗ ${failed} statements failed`)
  process.exit(1)
}

// ─── Verify: list all tables ─────────────────────────────────
console.log('\n📋 Tables on Turso:')
const tablesResult = await client.execute(
  `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name`
)
for (const row of tablesResult.rows) {
  console.log(`  • ${row.name}`)
}
console.log(`\nTotal: ${tablesResult.rows.length} tables`)

// ─── Apply column migrations (additive ALTER TABLE) ──────────
// These bring older DBs up to date with the latest schema by adding
// any missing columns. Idempotent.
const COLUMN_MIGRATIONS = [
  // stores
  { table: 'stores', column: 'logoUrl', typeDef: 'TEXT' },
  { table: 'stores', column: 'defaultBanner1Url', typeDef: 'TEXT' },
  { table: 'stores', column: 'defaultBanner2Url', typeDef: 'TEXT' },
  // products
  { table: 'products', column: 'originalPrice', typeDef: 'REAL' },
  { table: 'products', column: 'images', typeDef: 'TEXT' },
  { table: 'products', column: 'brand', typeDef: 'TEXT' },
  { table: 'products', column: 'rating', typeDef: 'REAL NOT NULL DEFAULT 0' },
  { table: 'products', column: 'reviewCount', typeDef: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'products', column: 'expiryDate', typeDef: 'DATETIME' },
  { table: 'products', column: 'bestBeforeDate', typeDef: 'DATETIME' },
  // shifts
  { table: 'shifts', column: 'manualHours', typeDef: 'REAL' },
  // users
  { table: 'users', column: 'mustResetPassword', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
  // users — dual-role support (JSON-encoded string array of secondary Role enum values)
  { table: 'users', column: 'additionalRoles', typeDef: "TEXT NOT NULL DEFAULT '[]'" },
  // orders
  { table: 'orders', column: 'promotionId', typeDef: 'TEXT' },
  { table: 'orders', column: 'discountAmount', typeDef: 'REAL NOT NULL DEFAULT 0' },
  { table: 'orders', column: 'bankTransferRef', typeDef: 'TEXT' },
  { table: 'orders', column: 'bankTransferVerified', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
  { table: 'orders', column: 'deliveryPhotoUrl', typeDef: 'TEXT' },
  { table: 'orders', column: 'batchGroup', typeDef: 'TEXT' },
  { table: 'orders', column: 'packedAt', typeDef: 'DATETIME' },
  { table: 'orders', column: 'dispatchedAt', typeDef: 'DATETIME' },
  { table: 'orders', column: 'deliveredAt', typeDef: 'DATETIME' },
  // orders — approximate delivery time set by admin/driver when assigning a driver.
  // Drives the "Will be delivered by HH:MM" customer-facing ETA display.
  { table: 'orders', column: 'estimatedDeliveryAt', typeDef: 'DATETIME' },
  { table: 'orders', column: 'hasChallenge25', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
  { table: 'orders', column: 'challenge25Verified', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
  // order_items
  { table: 'order_items', column: 'picked', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
]

console.log('\n🔧 Running column migrations (idempotent)...')
let colsAdded = 0
let colsSkipped = 0
for (const m of COLUMN_MIGRATIONS) {
  try {
    const cols = await client.execute(`PRAGMA table_info(${m.table})`)
    const exists = cols.rows.some(r => r.name === m.column)
    if (!exists) {
      await client.execute(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.typeDef}`)
      console.log(`  + ${m.table}.${m.column} (added)`)
      colsAdded++
    } else {
      colsSkipped++
    }
  } catch (err) {
    console.warn(`  ? ${m.table}.${m.column} skipped: ${err.message}`)
  }
}
console.log(`  → ${colsAdded} columns added, ${colsSkipped} already existed`)

console.log('\n✅ Migration complete. Turso DB is ready for the app to use.')
await client.close()
