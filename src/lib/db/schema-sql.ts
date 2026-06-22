// ============================================================
// Shared SQL schema for Fresh Mart database.
// Used by:
//   - src/lib/auth/prisma.ts (SQLite fallback path, runtime schema creation)
//   - scripts/turso-migrate.mjs (Turso schema push)
//
// Single source of truth: prisma/schema.sql
// ============================================================

import fs from 'fs'
import path from 'path'

let cachedSchema: string | null = null

/**
 * Returns the SQL schema as a single string.
 * Statements are separated by semicolons and use `CREATE TABLE IF NOT EXISTS`
 * so re-running is idempotent.
 */
export function getSchemaSql(): string {
  if (cachedSchema) return cachedSchema
  const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.sql')
  cachedSchema = fs.readFileSync(schemaPath, 'utf8')
  return cachedSchema
}

/**
 * Returns the schema as an array of individual SQL statements,
 * safe to execute one-by-one. Filters out empty statements.
 */
export function getSchemaStatements(): string[] {
  return getSchemaSql()
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}
