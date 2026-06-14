// ============================================================
// Prisma client singleton for auth operations
// Works with the expanded grocery store schema.
// Auto-creates the DB file if it doesn't exist.
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  dbReady: boolean | undefined
}

/**
 * Resolve the database URL at runtime.
 *
 * Production runs from /var/task/ (serverless). The .env
 * DATABASE_URL=file:./db/custom.db is relative to CWD.
 * We need to:
 * 1. Resolve the relative path to absolute
 * 2. If the file doesn't exist, create it
 * 3. Fall back to /tmp if needed
 */
async function resolveAndEnsureDatabase(): Promise<string> {
  const configuredUrl = process.env.DATABASE_URL || ''

  // Extract the file path from the SQLite URL
  let configuredPath = configuredUrl.replace(/^file:/, '')

  // Resolve relative paths against CWD
  if (configuredPath && !path.isAbsolute(configuredPath)) {
    configuredPath = path.resolve(process.cwd(), configuredPath)
  }

  // Candidate paths to try, in order of preference
  const candidates: string[] = []

  if (configuredPath) {
    candidates.push(configuredPath)
  }

  // Fallback: relative to current working directory
  candidates.push(path.resolve(process.cwd(), 'db', 'custom.db'))

  // Fallback: /tmp (always writable in serverless containers)
  candidates.push(path.resolve('/tmp', 'freshmart', 'custom.db'))

  for (const dbPath of candidates) {
    const dir = path.dirname(dbPath)

    try {
      // Ensure the directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Check if directory is writable
      const testFile = path.join(dir, `.write_test_${Date.now()}`)
      fs.writeFileSync(testFile, '')
      fs.unlinkSync(testFile)

      const dbUrl = `file:${dbPath}`

      // If the DB file already exists and has content, use it
      if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
        process.env.DATABASE_URL = dbUrl
        console.log(`[Prisma] Using existing database at: ${dbPath}`)
        return dbUrl
      }

      // DB file doesn't exist or is empty — create it
      console.log(`[Prisma] Database not found at ${dbPath}, creating...`)

      // Create empty SQLite file
      fs.writeFileSync(dbPath, '')
      process.env.DATABASE_URL = dbUrl

      console.log('[Prisma] Database file created. Schema will be applied via prisma db push.')

      return dbUrl
    } catch {
      // This path isn't writable, try the next one
      continue
    }
  }

  // Last resort: use the original configured path
  console.error('[Prisma] No writable directory found for database!')
  return configuredUrl
}

// Initialize Prisma client
let prismaInstance: PrismaClient | undefined
let initPromise: Promise<void> | undefined

function getInitPromise(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (globalForPrisma.prisma) {
      prismaInstance = globalForPrisma.prisma
      return
    }

    await resolveAndEnsureDatabase()

    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaInstance
    }

    globalForPrisma.dbReady = true
  })()

  return initPromise
}

// Eagerly start initialization
getInitPromise()

/**
 * Get the Prisma client, ensuring initialization is complete.
 * Call this at the start of any route handler that uses the database.
 */
export async function getPrisma(): Promise<PrismaClient> {
  await getInitPromise()
  return prismaInstance!
}

// For backward compatibility: export a PrismaClient directly.
// This works because module-level side effects start the init,
// and by the time a request reaches a route handler, init is done.
// But if init isn't done yet, the caller should use getPrisma().
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (prismaInstance) {
      return Reflect.get(prismaInstance, prop, receiver)
    }
    // If init isn't done, we need to throw a helpful error
    throw new Error(
      '[Prisma] Database not initialized yet. Use getPrisma() in async contexts, ' +
      'or ensure the module has had time to initialize before making queries.'
    )
  },
})
