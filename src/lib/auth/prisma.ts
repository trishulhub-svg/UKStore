// ============================================================
// Prisma client singleton for auth operations
// Ensures database exists and is migrated before first use
// Handles both local dev and deployed production environments
// ============================================================

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  dbInitialized: boolean | undefined
}

/**
 * Resolve the actual database file path at runtime.
 * 
 * The DATABASE_URL in .env uses an absolute path that may not be accessible
 * in the deployed environment (containerized/sandboxed). This function:
 * 1. Tries the configured DATABASE_URL first
 * 2. If that fails, falls back to a writable location
 * 3. Returns the resolved absolute path
 */
function resolveDatabasePath(): string {
  const configuredUrl = process.env.DATABASE_URL || ''
  
  // Extract file path from SQLite URL
  const configuredPath = configuredUrl.replace(/^file:/, '')
  
  if (!configuredPath) {
    // No DATABASE_URL at all — use fallback
    return findWritableDbPath('custom.db')
  }
  
  // If it's an absolute path, check if it's accessible
  if (path.isAbsolute(configuredPath)) {
    const dir = path.dirname(configuredPath)
    // Check if the directory exists and is writable
    if (fs.existsSync(dir) && canWrite(dir)) {
      // Directory exists and is writable — use the configured path
      return configuredPath
    }
    
    // The configured directory isn't accessible (deployed environment)
    // Fall back to a writable location
    console.warn(`[Prisma] Configured DB path not accessible: ${configuredPath}`)
    return findWritableDbPath(path.basename(configuredPath))
  }
  
  // Relative path — resolve from cwd
  return path.resolve(process.cwd(), configuredPath)
}

/**
 * Check if a directory is writable.
 */
function canWrite(dirPath: string): boolean {
  try {
    const testFile = path.join(dirPath, `.prisma_write_test_${Date.now()}`)
    fs.writeFileSync(testFile, '')
    fs.unlinkSync(testFile)
    return true
  } catch {
    return false
  }
}

/**
 * Find a writable directory for the database file.
 * Tries multiple locations in order of preference.
 */
function findWritableDbPath(filename: string): string {
  // Try these locations in order
  const candidates = [
    // 1. Same directory as the running process (project root)
    path.resolve(process.cwd(), 'db', filename),
    // 2. Inside .next directory (always part of deployed output)
    path.resolve(process.cwd(), '.next', 'db', filename),
    // 3. /tmp (always writable in Linux containers)
    path.resolve('/tmp', `freshmart-${filename}`),
    // 4. Home directory data folder
    path.resolve(process.env.HOME || '/tmp', '.freshmart', filename),
  ]

  for (const candidate of candidates) {
    const dir = path.dirname(candidate)
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      if (canWrite(dir)) {
        console.log(`[Prisma] Using writable DB path: ${candidate}`)
        return candidate
      }
    } catch {
      continue
    }
  }

  // Last resort — just return the original configured path and let it fail with a clear error
  console.error('[Prisma] No writable directory found for database!')
  return path.resolve(process.cwd(), 'db', filename)
}

/**
 * Ensure the database file exists and has the correct schema.
 * Runs prisma db push if the file doesn't exist.
 */
function ensureDatabaseExists(): string {
  const dbPath = resolveDatabasePath()
  const dbUrl = `file:${dbPath}`

  // Update the environment variable so Prisma uses the resolved path
  process.env.DATABASE_URL = dbUrl

  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
    console.log('[Prisma] Database file not found or empty at', dbPath, '— creating...')
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    try {
      execSync('npx prisma db push --skip-generate --accept-data-loss', {
        stdio: 'pipe',
        timeout: 30000,
        env: { ...process.env, DATABASE_URL: dbUrl },
      })
      console.log('[Prisma] Database created and migrated successfully at', dbPath)
    } catch (err) {
      console.error('[Prisma] Failed to auto-migrate database:', err)
      // Try to create an empty SQLite file as last resort
      // Prisma will throw a clearer error on first query
      try {
        fs.writeFileSync(dbPath, '')
      } catch (writeErr) {
        console.error('[Prisma] Failed to create database file:', writeErr)
      }
    }
  }

  return dbUrl
}

// Initialize on first import
if (!globalForPrisma.dbInitialized) {
  try {
    const resolvedUrl = ensureDatabaseExists()
    console.log('[Prisma] DATABASE_URL resolved to:', resolvedUrl.replace(/\/[^/]*$/, '/***'))
  } catch (err) {
    console.error('[Prisma] Database initialization error:', err)
  }
  globalForPrisma.dbInitialized = true
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
