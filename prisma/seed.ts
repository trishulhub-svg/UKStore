// ============================================================
// Database Seed Script
// Creates comprehensive seed data for the grocery store app
// Usage:
//   - SQLite (local dev): npx tsx prisma/seed.ts
//   - Turso (production): npm run db:seed:turso
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// ─── Prisma client construction (dual-backend) ─────────────────
// If TURSO_DATABASE_URL is set, use the libSQL adapter. Otherwise,
// fall back to standard PrismaClient (uses DATABASE_URL = file:...).
async function createPrismaClient(): Promise<PrismaClient> {
  if (process.env.TURSO_DATABASE_URL) {
    const { PrismaLibSql } = await import('@prisma/adapter-libsql')
    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    return new PrismaClient({
      adapter,
      log: ['error', 'warn'],
    })
  }
  return new PrismaClient()
}

let prisma: PrismaClient
const prismaReady = createPrismaClient().then(c => { prisma = c })

const SALT_ROUNDS = 12

// ─── Seed Data ─────────────────────────────────────────────

const STORE_ID = 'store-fresh-mart-001'

const CATEGORIES = [
  { id: 'cat-fruits-vegetables', name: 'Fruits & Vegetables', slug: 'fruits-vegetables', description: 'Fresh produce delivered daily', sortOrder: 1 },
  { id: 'cat-dairy-eggs', name: 'Dairy & Eggs', slug: 'dairy-eggs', description: 'Milk, cheese, butter and eggs', sortOrder: 2 },
  { id: 'cat-meat-fish', name: 'Meat & Fish', slug: 'meat-fish', description: 'Fresh meat and fish counter', sortOrder: 3 },
  { id: 'cat-bakery', name: 'Bakery', slug: 'bakery', description: 'Freshly baked bread and pastries', sortOrder: 4 },
  { id: 'cat-pantry', name: 'Pantry', slug: 'pantry', description: 'Rice, pasta, sauces and more', sortOrder: 5 },
  { id: 'cat-drinks', name: 'Drinks', slug: 'drinks', description: 'Juices, water, soft drinks and tea', sortOrder: 6 },
  { id: 'cat-frozen', name: 'Frozen', slug: 'frozen', description: 'Frozen meals, ice cream and more', sortOrder: 7 },
  { id: 'cat-snacks-sweets', name: 'Snacks & Sweets', slug: 'snacks-sweets', description: 'Crisps, biscuits, chocolate and more', sortOrder: 8 },
]

const PRODUCTS = [
  // Fruits & Vegetables
  { id: 'prod-001', categoryId: 'cat-fruits-vegetables', name: 'Organic Bananas', slug: 'organic-bananas', description: 'Fairtrade organic bananas, pack of 6', price: 1.49, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 150, isFeatured: true, sortOrder: 0 },
  { id: 'prod-002', categoryId: 'cat-fruits-vegetables', name: 'Baby Spinach', slug: 'baby-spinach', description: 'Fresh baby spinach leaves, 200g bag', price: 1.89, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 80, isFeatured: false, sortOrder: 1 },
  { id: 'prod-003', categoryId: 'cat-fruits-vegetables', name: 'British Strawberries', slug: 'british-strawberries', description: 'Sweet British strawberries, 400g', price: 3.49, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 45, isFeatured: true, sortOrder: 2 },

  // Dairy & Eggs
  { id: 'prod-004', categoryId: 'cat-dairy-eggs', name: 'Free Range Eggs', slug: 'free-range-eggs', description: 'Free range large eggs, pack of 12', price: 2.79, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 100, isFeatured: true, sortOrder: 0 },
  { id: 'prod-005', categoryId: 'cat-dairy-eggs', name: 'Semi-Skimmed Milk', slug: 'semi-skimmed-milk', description: 'British semi-skimmed milk, 2 litres', price: 1.65, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 200, isFeatured: false, sortOrder: 1 },
  { id: 'prod-006', categoryId: 'cat-dairy-eggs', name: 'Mature Cheddar', slug: 'mature-cheddar', description: 'Strong mature cheddar cheese, 400g', price: 3.29, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 60, isFeatured: false, sortOrder: 2 },
  { id: 'prod-019', categoryId: 'cat-dairy-eggs', name: 'Greek Yogurt', slug: 'greek-yogurt', description: 'Thick and creamy Greek yogurt, 500g', price: 2.49, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 70, isFeatured: true, sortOrder: 3 },

  // Meat & Fish
  { id: 'prod-007', categoryId: 'cat-meat-fish', name: 'Chicken Breast', slug: 'chicken-breast', description: 'Free range chicken breast fillets, 500g', price: 5.99, vatRate: 0.0, isHfss: false, unit: 'kg', weightKg: 0.5, stockQuantity: 40, isFeatured: true, sortOrder: 0 },
  { id: 'prod-008', categoryId: 'cat-meat-fish', name: 'Scottish Salmon Fillet', slug: 'scottish-salmon-fillet', description: 'Fresh Scottish salmon fillet, 200g', price: 6.49, vatRate: 0.0, isHfss: false, unit: 'each', weightKg: 0.2, stockQuantity: 25, isFeatured: false, sortOrder: 1 },

  // Bakery
  { id: 'prod-009', categoryId: 'cat-bakery', name: 'Sourdough Loaf', slug: 'sourdough-loaf', description: 'Artisan sourdough bread, freshly baked', price: 3.49, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 30, isFeatured: true, sortOrder: 0 },
  { id: 'prod-010', categoryId: 'cat-bakery', name: 'Croissants', slug: 'croissants', description: 'Butter croissants, pack of 4', price: 2.29, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 50, isFeatured: false, sortOrder: 1 },

  // Pantry
  { id: 'prod-011', categoryId: 'cat-pantry', name: 'Basmati Rice', slug: 'basmati-rice', description: 'Premium basmati rice, 1kg', price: 2.99, vatRate: 0.0, isHfss: false, unit: 'each', weightKg: 1.0, stockQuantity: 90, isFeatured: false, sortOrder: 0 },
  { id: 'prod-012', categoryId: 'cat-pantry', name: 'Penne Pasta', slug: 'penne-pasta', description: 'Italian penne pasta, 500g', price: 1.29, vatRate: 0.0, isHfss: false, unit: 'each', weightKg: 0.5, stockQuantity: 120, isFeatured: false, sortOrder: 1 },
  { id: 'prod-020', categoryId: 'cat-pantry', name: 'Extra Virgin Olive Oil', slug: 'extra-virgin-olive-oil', description: 'Italian extra virgin olive oil, 500ml', price: 5.99, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 35, isFeatured: true, sortOrder: 2 },

  // Drinks
  { id: 'prod-013', categoryId: 'cat-drinks', name: 'Orange Juice', slug: 'orange-juice', description: 'Freshly squeezed orange juice, 1L', price: 2.49, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 75, isFeatured: true, sortOrder: 0 },
  { id: 'prod-014', categoryId: 'cat-drinks', name: 'Coca-Cola', slug: 'coca-cola', description: 'Classic Coca-Cola, 1.5L bottle', price: 1.99, vatRate: 0.2, isHfss: true, unit: 'each', stockQuantity: 100, isFeatured: false, sortOrder: 1 },

  // Frozen
  { id: 'prod-015', categoryId: 'cat-frozen', name: 'Frozen Pizza', slug: 'frozen-pizza', description: 'Stone baked margherita pizza', price: 3.49, vatRate: 0.0, isHfss: true, unit: 'each', stockQuantity: 55, isFeatured: false, sortOrder: 0 },

  // Snacks & Sweets
  { id: 'prod-016', categoryId: 'cat-snacks-sweets', name: 'Salt & Vinegar Crisps', slug: 'salt-vinegar-crisps', description: 'Classic salt and vinegar crisps, 150g', price: 1.59, vatRate: 0.2, isHfss: true, unit: 'each', stockQuantity: 80, isFeatured: false, sortOrder: 0 },
  { id: 'prod-017', categoryId: 'cat-snacks-sweets', name: 'Dark Chocolate Bar', slug: 'dark-chocolate-bar', description: '70% cocoa dark chocolate, 100g', price: 1.89, vatRate: 0.0, isHfss: true, unit: 'each', stockQuantity: 60, isFeatured: false, sortOrder: 1 },
  { id: 'prod-018', categoryId: 'cat-snacks-sweets', name: 'Mixed Nuts', slug: 'mixed-nuts', description: 'Roasted and salted mixed nuts, 200g', price: 3.29, vatRate: 0.0, isHfss: false, unit: 'each', stockQuantity: 40, isFeatured: false, sortOrder: 2 },
]

const STORE_SETTINGS = [
  { key: 'stripe_publishable_key', value: '', isSecret: true, category: 'integrations' as const, description: 'Stripe Publishable Key (pk_test_... or pk_live_...)' },
  { key: 'stripe_secret_key', value: '', isSecret: true, category: 'integrations' as const, description: 'Stripe Secret Key (sk_test_... or sk_live_...)' },
  { key: 'stripe_webhook_secret', value: '', isSecret: true, category: 'integrations' as const, description: 'Stripe Webhook Signing Secret (whsec_...)' },
  { key: 'google_oauth_client_id', value: '', isSecret: false, category: 'integrations' as const, description: 'Google OAuth Client ID' },
  { key: 'google_oauth_client_secret', value: '', isSecret: true, category: 'integrations' as const, description: 'Google OAuth Client Secret' },
  { key: 'sendgrid_api_key', value: '', isSecret: true, category: 'notifications' as const, description: 'SendGrid API Key' },
  { key: 'taxjar_api_key', value: '', isSecret: true, category: 'integrations' as const, description: 'TaxJar API Key (optional)' },
]

async function main() {
  await prismaReady
  console.log('🌱 Seeding database...\n')

  // ─── Store ─────────────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { id: STORE_ID },
    update: {
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
    },
    create: {
      id: STORE_ID,
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
    },
  })
  console.log(`✅ Store: ${store.name}`)

  // ─── Categories ────────────────────────────────────────
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
      create: {
        id: cat.id,
        storeId: STORE_ID,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    })
  }
  console.log(`✅ Categories: ${CATEGORIES.length} created`)

  // ─── Products ──────────────────────────────────────────
  for (const prod of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: prod.price,
        vatRate: prod.vatRate,
        isHfss: prod.isHfss,
        unit: prod.unit,
        weightKg: prod.weightKg || null,
        stockQuantity: prod.stockQuantity,
        isFeatured: prod.isFeatured,
        isAvailable: true,
        sortOrder: prod.sortOrder,
      },
      create: {
        id: prod.id,
        storeId: STORE_ID,
        categoryId: prod.categoryId,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: prod.price,
        vatRate: prod.vatRate,
        isHfss: prod.isHfss,
        unit: prod.unit,
        weightKg: prod.weightKg || null,
        stockQuantity: prod.stockQuantity,
        isFeatured: prod.isFeatured,
        isAvailable: true,
        sortOrder: prod.sortOrder,
      },
    })
  }
  console.log(`✅ Products: ${PRODUCTS.length} created`)

  // ─── Store Settings ────────────────────────────────────
  for (const setting of STORE_SETTINGS) {
    await prisma.storeSetting.upsert({
      where: {
        storeId_key: { storeId: STORE_ID, key: setting.key },
      },
      update: {
        value: setting.value,
        isSecret: setting.isSecret,
        category: setting.category,
        description: setting.description,
      },
      create: {
        storeId: STORE_ID,
        key: setting.key,
        value: setting.value,
        isSecret: setting.isSecret,
        category: setting.category,
        description: setting.description,
      },
    })
  }
  console.log(`✅ Store Settings: ${STORE_SETTINGS.length} created`)

  // ─── Owner Account ─────────────────────────────────────
  // IMPORTANT: Must match the email used in src/lib/auth/prisma.ts seedIfEmpty().
  // On Vercel's ephemeral filesystem, this is what gets re-created on every cold start.
  const ownerEmail = 'kiranpradhan2057@gmail.com'
  const ownerPassword = 'Admin@2026'

  const existingOwner = await prisma.user.findUnique({
    where: { email: ownerEmail },
  })

  if (existingOwner) {
    const passwordHash = await bcrypt.hash(ownerPassword, SALT_ROUNDS)
    await prisma.user.update({
      where: { id: existingOwner.id },
      data: { role: 'OWNER', name: 'Store Owner', passwordHash, isActive: true },
    })
    console.log(`✅ Updated owner account: ${ownerEmail} (role: OWNER)`)
  } else {
    const passwordHash = await bcrypt.hash(ownerPassword, SALT_ROUNDS)
    await prisma.user.create({
      data: {
        email: ownerEmail,
        name: 'Store Owner',
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    })
    console.log(`✅ Created owner account: ${ownerEmail} (role: OWNER)`)
  }

  // ─── Driver Account ────────────────────────────────────
  const driverEmail = 'driver@freshmart.co.uk'
  const driverPassword = 'Driver@2026'

  const existingDriver = await prisma.user.findUnique({
    where: { email: driverEmail },
  })

  if (existingDriver) {
    const passwordHash = await bcrypt.hash(driverPassword, SALT_ROUNDS)
    await prisma.user.update({
      where: { id: existingDriver.id },
      data: { role: 'DRIVER', name: 'Demo Driver', passwordHash, isActive: true },
    })
    console.log(`✅ Updated driver account: ${driverEmail} (role: DRIVER)`)
  } else {
    const passwordHash = await bcrypt.hash(driverPassword, SALT_ROUNDS)
    const driver = await prisma.user.create({
      data: {
        email: driverEmail,
        name: 'Demo Driver',
        passwordHash,
        role: 'DRIVER',
        isActive: true,
      },
    })
    // Create driver profile
    await prisma.driverProfile.upsert({
      where: { userId: driver.id },
      update: { vehicleType: 'bicycle', verificationStatus: 'approved' },
      create: {
        userId: driver.id,
        vehicleType: 'bicycle',
        verificationStatus: 'approved',
      },
    })
    console.log(`✅ Created driver account: ${driverEmail} (role: DRIVER)`)
  }

  // ─── Customer Account ──────────────────────────────────
  const customerEmail = 'customer@freshmart.co.uk'
  const customerPassword = 'Customer@2026'

  const existingCustomer = await prisma.user.findUnique({
    where: { email: customerEmail },
  })

  if (existingCustomer) {
    const passwordHash = await bcrypt.hash(customerPassword, SALT_ROUNDS)
    await prisma.user.update({
      where: { id: existingCustomer.id },
      data: { role: 'CUSTOMER', name: 'Demo Customer', passwordHash, isActive: true },
    })
    console.log(`✅ Updated customer account: ${customerEmail} (role: CUSTOMER)`)
  } else {
    const passwordHash = await bcrypt.hash(customerPassword, SALT_ROUNDS)
    await prisma.user.create({
      data: {
        email: customerEmail,
        name: 'Demo Customer',
        passwordHash,
        role: 'CUSTOMER',
        isActive: true,
      },
    })
    console.log(`✅ Created customer account: ${customerEmail} (role: CUSTOMER)`)
  }

  // ─── Summary ───────────────────────────────────────────
  console.log('\n📋 Seed Summary:')
  console.log('─────────────────────────────────────────')
  console.log(`  🏪 Store:   Fresh Mart London`)
  console.log(`  📂 Categories: ${CATEGORIES.length}`)
  console.log(`  🛒 Products: ${PRODUCTS.length}`)
  console.log(`  ⚙️  Settings: ${STORE_SETTINGS.length}`)
  console.log('─────────────────────────────────────────')
  console.log('\n👤 Account Summary:')
  console.log('─────────────────────────────────────────')
  console.log(`  👑 Owner:    ${ownerEmail} / ${ownerPassword}`)
  console.log(`  🚗 Driver:   ${driverEmail} / ${driverPassword}`)
  console.log(`  🛍️  Customer: ${customerEmail} / ${customerPassword}`)
  console.log('─────────────────────────────────────────')
  console.log('\n🔐 Admin Panel: /admin')
  console.log('⚠️  Change these passwords after first login!\n')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
