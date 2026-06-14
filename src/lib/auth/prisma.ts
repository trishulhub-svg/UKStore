// ============================================================
// Prisma client singleton for auth operations
// Works with the expanded grocery store schema.
// Auto-creates the DB file AND schema if they don't exist.
// Auto-seeds the admin user on fresh database creation.
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
 * SQL statements to create the FULL schema from scratch.
 * These mirror the Prisma schema in prisma/schema.prisma.
 * Uses CREATE TABLE IF NOT EXISTS for safe re-execution.
 */
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
  "vatRate" REAL NOT NULL DEFAULT 0.0,
  "isHfss" BOOLEAN NOT NULL DEFAULT 0,
  "imageUrl" TEXT,
  "barcode" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'each',
  "weightKg" REAL,
  "volumeLitres" REAL,
  "aisle" TEXT,
  "minStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "substituteProductId" TEXT,
  "isAvailable" BOOLEAN NOT NULL DEFAULT 1,
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" BOOLEAN NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
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
`

/**
 * Resolve the database URL at runtime.
 *
 * Production runs from /var/task/ (serverless). The .env
 * DATABASE_URL=file:./db/custom.db is relative to CWD.
 * We need to:
 * 1. Resolve the relative path to absolute
 * 2. If the file doesn't exist, create it with schema
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

      // DB file doesn't exist or is empty — create it with schema
      console.log(`[Prisma] Database not found at ${dbPath}, creating with full schema...`)

      // Create empty SQLite file
      fs.writeFileSync(dbPath, '')
      process.env.DATABASE_URL = dbUrl

      // Create a temporary client to push the schema
      const tempClient = new PrismaClient({
        datasources: { db: { url: dbUrl } },
      })

      try {
        // Execute each statement separately for reliability
        const statements = SCHEMA_SQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0)

        for (const stmt of statements) {
          await tempClient.$executeRawUnsafe(stmt)
        }

        console.log('[Prisma] Database schema created successfully at:', dbPath)
      } catch (schemaErr) {
        console.error('[Prisma] Schema creation error:', schemaErr)
      } finally {
        await tempClient.$disconnect()
      }

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

/**
 * Seed the database with essential data (admin user, store, etc.)
 * Only runs on fresh databases that have no users.
 */
async function seedIfEmpty(prisma: PrismaClient): Promise<void> {
  try {
    const userCount = await prisma.user.count()
    if (userCount > 0) {
      return // Database already has users, skip seeding
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

    // Auto-seed if the database is empty
    await seedIfEmpty(prismaInstance)

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
