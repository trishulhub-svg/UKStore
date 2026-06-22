// Quick verification script — query Turso DB to confirm data is in place.
import { config } from 'dotenv'
import { createClient } from '@libsql/client'

config()

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const queries = [
  { label: 'Users', sql: 'SELECT email, role FROM users ORDER BY role' },
  { label: 'Store', sql: 'SELECT name, slug FROM stores' },
  { label: 'Categories count', sql: "SELECT COUNT(*) as n FROM categories" },
  { label: 'Products count', sql: "SELECT COUNT(*) as n FROM products" },
  { label: 'Sessions count (should be 0)', sql: "SELECT COUNT(*) as n FROM sessions" },
  { label: 'Feature permissions (should be 0)', sql: "SELECT COUNT(*) as n FROM employee_feature_permissions" },
]

for (const q of queries) {
  console.log(`\n── ${q.label} ──`)
  const result = await client.execute(q.sql)
  for (const row of result.rows) {
    console.log('  ', row)
  }
}

await client.close()
console.log('\n✅ Verification complete.')
