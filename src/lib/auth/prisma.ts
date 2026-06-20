// ============================================================
// Prisma client singleton for auth operations
// Works with the expanded grocery store schema.
// Auto-creates the DB file AND schema if they don't exist.
// Auto-seeds the admin user on fresh database creation.
// Robust for Vercel serverless (ephemeral /tmp filesystem).
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  dbReady: boolean | undefined
}

// ─── Database Path Resolution ──────────────────────────────────

/**
 * Detect if we're running on Vercel serverless.
 */
function isVercel(): boolean {
  return !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

/**
 * Find a working database path.
 * On Vercel: always use /tmp (writable, ephemeral).
 * Locally: use the configured DATABASE_URL path.
 */
function resolveDatabasePath(): { dbPath: string; dbUrl: string; writable: boolean } {
  const configuredUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  let configuredPath = configuredUrl.replace(/^file:/, '')

  // Resolve relative paths against CWD
  if (configuredPath && !path.isAbsolute(configuredPath)) {
    configuredPath = path.resolve(process.cwd(), configuredPath)
  }

  // On Vercel, always prefer /tmp for the database
  if (isVercel()) {
    const tmpPath = '/tmp/freshmart/custom.db'
    return { dbPath: tmpPath, dbUrl: `file:${tmpPath}`, writable: true }
  }

  // Locally, use the configured path
  return { dbPath: configuredPath, dbUrl: `file:${configuredPath}`, writable: true }
}

// ─── SQL Schema ────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "passwordHash" TEXT,
  "phone" TEXT,
  "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
  "avatarUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "mustResetPassword" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE TABLE IF NOT EXISTS "stores" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "latitude" REAL NOT NULL,
  "longitude" REAL NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "logoUrl" TEXT,
  "defaultBanner1Url" TEXT,
  "defaultBanner2Url" TEXT,
  "baseDeliveryFee" REAL NOT NULL DEFAULT 3.5,
  "perKmCharge" REAL NOT NULL DEFAULT 0.5,
  "freeDeliveryThreshold" REAL NOT NULL DEFAULT 20.0,
  "deliveryRadiusKm" REAL NOT NULL DEFAULT 5.0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "isOpen" BOOLEAN NOT NULL DEFAULT 1,
  "openingHours" TEXT,
  "bankHolidayMode" TEXT NOT NULL DEFAULT 'auto_close',
  "notificationTemplate" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "stores_slug_key" ON "stores"("slug");

CREATE TABLE IF NOT EXISTS "categories" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "parentId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "categories_storeId_slug_key" ON "categories"("storeId", "slug");

CREATE TABLE IF NOT EXISTS "products" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "price" REAL NOT NULL,
  "originalPrice" REAL,
  "vatRate" REAL NOT NULL DEFAULT 0.0,
  "isHfss" BOOLEAN NOT NULL DEFAULT 0,
  "isAgeRestricted" BOOLEAN NOT NULL DEFAULT 0,
  "minimumAge" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" TEXT,
  "images" TEXT,
  "barcode" TEXT,
  "brand" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'each',
  "weightKg" REAL,
  "volumeLitres" REAL,
  "aisle" TEXT,
  "minStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "substituteProductId" TEXT,
  "isAvailable" BOOLEAN NOT NULL DEFAULT 1,
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" BOOLEAN NOT NULL DEFAULT 0,
  "rating" REAL NOT NULL DEFAULT 0,
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "expiryDate" DATETIME,
  "bestBeforeDate" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("substituteProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "products_storeId_slug_key" ON "products"("storeId", "slug");

CREATE TABLE IF NOT EXISTS "addresses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "label" TEXT,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "postcode" TEXT NOT NULL,
  "latitude" REAL,
  "longitude" REAL,
  "isDefault" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "driverId" TEXT,
  "addressId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'placed',
  "subtotal" REAL NOT NULL,
  "vatAmount" REAL NOT NULL,
  "deliveryFee" REAL NOT NULL,
  "total" REAL NOT NULL,
  "stripeSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "paymentMethod" TEXT,
  "deliverySlot" DATETIME,
  "notes" TEXT,
  "hasChallenge25" BOOLEAN NOT NULL DEFAULT 0,
  "challenge25Verified" BOOLEAN NOT NULL DEFAULT 0,
  "batchGroup" TEXT,
  "packedAt" DATETIME,
  "dispatchedAt" DATETIME,
  "deliveredAt" DATETIME,
  "deliveryPhotoUrl" TEXT,
  "bankTransferRef" TEXT,
  "bankTransferVerified" BOOLEAN NOT NULL DEFAULT 0,
  "promotionId" TEXT,
  "discountAmount" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "order_items" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" REAL NOT NULL,
  "vatRate" REAL NOT NULL,
  "vatAmount" REAL NOT NULL,
  "subtotal" REAL NOT NULL,
  "substitutePreference" TEXT,
  "substitutedWith" TEXT,
  "picked" BOOLEAN NOT NULL DEFAULT 0,
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "store_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL DEFAULT '',
  "isSecret" BOOLEAN NOT NULL DEFAULT 1,
  "category" TEXT NOT NULL DEFAULT 'integrations',
  "description" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "store_settings_storeId_key_key" ON "store_settings"("storeId", "key");

CREATE TABLE IF NOT EXISTS "favourites" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "favourites_userId_productId_key" ON "favourites"("userId", "productId");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT 0,
  "link" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "driver_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "vehicleType" TEXT,
  "vehicleReg" TEXT,
  "nationalInsuranceNumber" TEXT,
  "rightToWorkUrl" TEXT,
  "drivingLicenseUrl" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
  "verifiedBy" TEXT,
  "verifiedAt" DATETIME,
  "rejectionReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "driver_profiles_userId_key" ON "driver_profiles"("userId");

CREATE TABLE IF NOT EXISTS "delivery_zones" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "postcodes" TEXT NOT NULL,
  "deliveryFee" REAL NOT NULL DEFAULT 0,
  "minimumOrder" REAL NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "promotions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "discountType" TEXT NOT NULL,
  "discountValue" REAL NOT NULL,
  "startDate" DATETIME NOT NULL,
  "endDate" DATETIME NOT NULL,
  "minimumOrderValue" REAL NOT NULL DEFAULT 0,
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "appliesToCategoryIds" TEXT,
  "excludesHfss" BOOLEAN NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "code" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "attendance_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "ipAddress" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "shifts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "manualHours" REAL,
  "role" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "wastage_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "loggedBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "date" DATETIME NOT NULL,
  "receiptUrl" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "bank_holidays" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'auto_close',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "banners" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "title" TEXT,
  "imageUrl" TEXT NOT NULL,
  "linkUrl" TEXT,
  "linkCategory" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "employee_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "salary" REAL,
  "wageRate" REAL,
  "wageType" TEXT,
  "bankName" TEXT,
  "bankAccountNo" TEXT,
  "bankSortCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "employee_profiles_userId_key" ON "employee_profiles"("userId");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL DEFAULT 'unknown',
  "deviceName" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON "sessions"("expiresAt");

CREATE TABLE IF NOT EXISTS "employee_feature_permissions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "features" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "employee_feature_permissions_userId_key" ON "employee_feature_permissions"("userId");
`

// ─── Schema Creation ────────────────────────────────────────────

/**
 * Column migrations — idempotent ALTER TABLE ADD COLUMN statements.
 *
 * SQLite doesn't support `IF NOT EXISTS` for ADD COLUMN, so we query
 * PRAGMA table_info first and only add columns that are missing.
 *
 * Each entry: { table, column, typeDef }
 * typeDef is the full "TYPE DEFAULT ..." clause as in CREATE TABLE.
 */
const COLUMN_MIGRATIONS: Array<{ table: string; column: string; typeDef: string }> = [
  // stores
  { table: 'stores', column: 'logoUrl', typeDef: 'TEXT' },
  { table: 'stores', column: 'defaultBanner1Url', typeDef: 'TEXT' },
  { table: 'stores', column: 'defaultBanner2Url', typeDef: 'TEXT' },
  // products — columns added after initial schema
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
  // orders — columns added for promotions / bank transfers
  { table: 'orders', column: 'promotionId', typeDef: 'TEXT' },
  { table: 'orders', column: 'discountAmount', typeDef: 'REAL NOT NULL DEFAULT 0' },
  { table: 'orders', column: 'bankTransferRef', typeDef: 'TEXT' },
  { table: 'orders', column: 'bankTransferVerified', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
  { table: 'orders', column: 'deliveryPhotoUrl', typeDef: 'TEXT' },
  { table: 'orders', column: 'batchGroup', typeDef: 'TEXT' },
  { table: 'orders', column: 'packedAt', typeDef: 'DATETIME' },
  { table: 'orders', column: 'dispatchedAt', typeDef: 'DATETIME' },
  { table: 'orders', column: 'deliveredAt', typeDef: 'DATETIME' },
  { table: 'orders', column: 'hasChallenge25', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
  { table: 'orders', column: 'challenge25Verified', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
  // order_items
  { table: 'order_items', column: 'picked', typeDef: 'BOOLEAN NOT NULL DEFAULT 0' },
]

/**
 * Idempotently create any missing tables on an EXISTING database.
 *
 * The SCHEMA_SQL block uses `CREATE TABLE IF NOT EXISTS` for every table,
 * so re-running it on an existing DB is safe — it will only create tables
 * that don't yet exist (e.g. banners, employee_profiles added in later
 * schema versions) and will not touch existing tables.
 *
 * This is critical for production databases that were created with an
 * older version of SCHEMA_SQL and need new tables added without data loss.
 */
async function ensureAllTablesExist(client: PrismaClient): Promise<void> {
  await executeSchemaSql(client)
}

async function runColumnMigrations(client: PrismaClient): Promise<void> {
  for (const m of COLUMN_MIGRATIONS) {
    try {
      const cols = await client.$queryRawUnsafe<{ name: string }[]>(
        `PRAGMA table_info(${m.table})`
      )
      const exists = cols.some((c) => c.name === m.column)
      if (!exists) {
        await client.$executeRawUnsafe(
          `ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.typeDef}`
        )
        console.log(`[Prisma] Migrated ${m.table}.${m.column} (added column)`)
      }
    } catch (err) {
      // Non-fatal — the column might already exist or the table might not exist yet
      console.warn(`[Prisma] Column migration ${m.table}.${m.column} skipped:`, err)
    }
  }
}

/**
 * Execute the schema SQL against a PrismaClient.
 * Returns true if all statements succeeded.
 */
async function executeSchemaSql(client: PrismaClient): Promise<boolean> {
  const statements = SCHEMA_SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  let failed = 0
  for (const stmt of statements) {
    try {
      await client.$executeRawUnsafe(stmt)
    } catch (err) {
      failed++
      console.error('[Prisma] Schema statement failed:', stmt.substring(0, 80), err)
    }
  }

  if (failed > 0) {
    console.error(`[Prisma] ${failed}/${statements.length} schema statements failed`)
  }

  return failed === 0
}

/**
 * Verify that the database has the essential tables.
 */
async function verifyDatabaseSchema(client: PrismaClient): Promise<boolean> {
  try {
    const tables = await client.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
    `
    const tableNames = tables.map(t => t.name)
    const requiredTables = ['users', 'stores', 'categories', 'products', 'orders', 'order_items']
    const missing = requiredTables.filter(t => !tableNames.includes(t))

    if (missing.length > 0) {
      console.error('[Prisma] Missing required tables:', missing)
      return false
    }

    console.log('[Prisma] Database schema verified. Tables:', tableNames.join(', '))
    return true
  } catch (err) {
    console.error('[Prisma] Schema verification failed:', err)
    return false
  }
}

// ─── Database Initialization ─────────────────────────────────────

/**
 * Try to copy the bundled database file from the deployment
 * directory to the target path. Returns true if copy succeeded.
 */
function tryCopyBundledDatabase(targetPath: string): boolean {
  try {
    // Possible locations of the bundled database in the deployment
    const bundledPaths = [
      path.resolve(process.cwd(), 'db', 'custom.db'),
      path.resolve(process.cwd(), '.next', 'server', 'db', 'custom.db'),
    ]

    for (const bundled of bundledPaths) {
      if (fs.existsSync(bundled) && fs.statSync(bundled).size > 0) {
        const dir = path.dirname(targetPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.copyFileSync(bundled, targetPath)
        console.log(`[Prisma] Copied bundled database from ${bundled} to ${targetPath}`)
        return true
      }
    }
  } catch (err) {
    console.warn('[Prisma] Could not copy bundled database:', err)
  }
  return false
}

/**
 * Initialize the database:
 * 1. Resolve the correct path (Vercel → /tmp, local → configured path)
 * 2. If DB exists and is valid, use it
 * 3. Try to copy bundled DB from deployment
 * 4. Otherwise, create from scratch with full schema
 * 5. Verify the schema is correct
 * 6. Seed essential data if empty
 */
async function initializeDatabase(): Promise<string> {
  const { dbPath, dbUrl } = resolveDatabasePath()
  const dir = path.dirname(dbPath)

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (mkdirErr) {
      console.error(`[Prisma] Cannot create directory ${dir}:`, mkdirErr)
      // Fallback to /tmp
      const fallbackPath = '/tmp/freshmart/custom.db'
      const fallbackDir = '/tmp/freshmart'
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true })
      }
      return await initializeDatabaseAtPath(fallbackPath, `file:${fallbackPath}`)
    }
  }

  return await initializeDatabaseAtPath(dbPath, dbUrl)
}

async function initializeDatabaseAtPath(dbPath: string, dbUrl: string): Promise<string> {
  // ─── Check if existing database is valid ─────────────────────
  if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 100) {
    // File exists and has content — verify it works
    const testClient = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })
    try {
      await testClient.$connect()
      const isValid = await verifyDatabaseSchema(testClient)
      if (isValid) {
        // Existing DB is valid — but it might be missing tables that were
        // added in later schema versions (banners, employee_profiles, etc.)
        // and missing columns that were added later. Run BOTH:
        //   1. ensureAllTablesExist — CREATE TABLE IF NOT EXISTS for every table
        //   2. runColumnMigrations — ALTER TABLE ADD COLUMN for every new column
        await ensureAllTablesExist(testClient)
        await runColumnMigrations(testClient)
        process.env.DATABASE_URL = dbUrl
        console.log(`[Prisma] Using existing database at: ${dbPath}`)
        await testClient.$disconnect()
        return dbUrl
      }
      // Schema is invalid — we need to recreate
      console.warn('[Prisma] Existing database has invalid schema, recreating...')
      await testClient.$disconnect()
    } catch (err) {
      console.warn('[Prisma] Existing database failed verification:', err)
      try { await testClient.$disconnect() } catch { /* ignore */ }
    }

    // Delete the corrupted database
    try {
      fs.unlinkSync(dbPath)
    } catch { /* ignore */ }
  }

  // ─── Try to copy bundled database ────────────────────────────
  if (tryCopyBundledDatabase(dbPath)) {
    const testClient = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })
    try {
      await testClient.$connect()
      const isValid = await verifyDatabaseSchema(testClient)
      if (isValid) {
        await ensureAllTablesExist(testClient)
        await runColumnMigrations(testClient)
        process.env.DATABASE_URL = dbUrl
        console.log(`[Prisma] Using copied bundled database at: ${dbPath}`)
        await testClient.$disconnect()
        return dbUrl
      }
      await testClient.$disconnect()
    } catch (err) {
      console.warn('[Prisma] Bundled database verification failed:', err)
      try { await testClient.$disconnect() } catch { /* ignore */ }
    }
  }

  // ─── Create database from scratch ────────────────────────────
  console.log(`[Prisma] Creating new database at: ${dbPath}`)
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Create empty file
  fs.writeFileSync(dbPath, '')
  process.env.DATABASE_URL = dbUrl

  const tempClient = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    await tempClient.$connect()
    const schemaOk = await executeSchemaSql(tempClient)

    if (!schemaOk) {
      // Schema creation partially failed — try again
      console.warn('[Prisma] Retrying schema creation...')
      await executeSchemaSql(tempClient)
    }

    // Run column migrations to add any newly added columns
    await runColumnMigrations(tempClient)

    // Verify schema
    const isValid = await verifyDatabaseSchema(tempClient)
    if (!isValid) {
      throw new Error('Database schema verification failed after creation')
    }

    console.log('[Prisma] Database created successfully at:', dbPath)
    return dbUrl
  } catch (err) {
    console.error('[Prisma] Database creation failed:', err)
    throw err
  } finally {
    try { await tempClient.$disconnect() } catch { /* ignore */ }
  }
}

// ─── Seeding ────────────────────────────────────────────────────

async function seedIfEmpty(prisma: PrismaClient): Promise<void> {
  try {
    const userCount = await prisma.user.count()
    if (userCount > 0) {
      console.log(`[Prisma] Database has ${userCount} users, skipping seed`)
      return
    }

    console.log('[Prisma] Fresh database detected, seeding essential data...')

    // ─── Create Store ────────────────────────────────────
    const storeId = 'store-fresh-mart-001'
    await prisma.store.upsert({
      where: { id: storeId },
      update: {},
      create: {
        id: storeId,
        name: 'Fresh Mart London',
        slug: 'fresh-mart-london',
        address: '123 High Street, Lewisham, London, SE13 6LG',
        latitude: 51.4612,
        longitude: -0.0117,
        phone: '+44 20 1234 5678',
        email: 'hello@freshmartlondon.co.uk',
        baseDeliveryFee: 3.50,
        perKmCharge: 0.50,
        freeDeliveryThreshold: 20.00,
        deliveryRadiusKm: 5.00,
        isActive: true,
        isOpen: true,
      },
    })
    console.log('[Prisma] Seeded store: Fresh Mart London')

    // ─── Create Owner Account ────────────────────────────
    const ownerEmail = 'admin@freshmart.co.uk'
    const ownerPassword = 'Admin@2026'
    const ownerHash = await bcrypt.hash(ownerPassword, 12)
    await prisma.user.create({
      data: {
        email: ownerEmail,
        name: 'Store Owner',
        passwordHash: ownerHash,
        role: 'OWNER',
        isActive: true,
      },
    })
    console.log('[Prisma] Seeded owner account:', ownerEmail)

    // ─── Create Driver Account ───────────────────────────
    const driverEmail = 'driver@freshmart.co.uk'
    const driverPassword = 'Driver@2026'
    const driverHash = await bcrypt.hash(driverPassword, 12)
    const driver = await prisma.user.create({
      data: {
        email: driverEmail,
        name: 'Demo Driver',
        passwordHash: driverHash,
        role: 'DRIVER',
        isActive: true,
      },
    })
    await prisma.driverProfile.create({
      data: {
        userId: driver.id,
        vehicleType: 'bicycle',
        verificationStatus: 'approved',
      },
    })
    console.log('[Prisma] Seeded driver account:', driverEmail)

    // ─── Create Customer Account ─────────────────────────
    const customerEmail = 'customer@freshmart.co.uk'
    const customerPassword = 'Customer@2026'
    const customerHash = await bcrypt.hash(customerPassword, 12)
    await prisma.user.create({
      data: {
        email: customerEmail,
        name: 'Demo Customer',
        passwordHash: customerHash,
        role: 'CUSTOMER',
        isActive: true,
      },
    })
    console.log('[Prisma] Seeded customer account:', customerEmail)

    console.log('[Prisma] Seeding complete!')
  } catch (seedErr) {
    console.error('[Prisma] Seeding error (non-fatal):', seedErr)
  }
}

// ─── Prisma Client Singleton ─────────────────────────────────────

let prismaInstance: PrismaClient | undefined
let initPromise: Promise<void> | undefined

function getInitPromise(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    // In development, reuse the cached instance
    if (globalForPrisma.prisma) {
      prismaInstance = globalForPrisma.prisma
      return
    }

    // Initialize database (resolve path, create schema if needed)
    const dbUrl = await initializeDatabase()
    process.env.DATABASE_URL = dbUrl

    // Create the Prisma client with the resolved URL
    prismaInstance = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

    // Connect and verify
    await prismaInstance.$connect()

    // Seed if empty
    await seedIfEmpty(prismaInstance)

    // Cache in development
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaInstance
    }

    globalForPrisma.dbReady = true
    console.log('[Prisma] Client initialized and ready')
  })()

  return initPromise
}

// Eagerly start initialization (fire and forget — getPrisma() will await it)
getInitPromise().catch(err => {
  console.error('[Prisma] Initialization failed:', err)
})

/**
 * Get the Prisma client, ensuring initialization is complete.
 * Call this at the start of any route handler that uses the database.
 */
export async function getPrisma(): Promise<PrismaClient> {
  await getInitPromise()
  if (!prismaInstance) {
    throw new Error('[Prisma] Client not initialized after awaiting init promise')
  }
  return prismaInstance
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
