// ============================================================
// Database Seed Script
// Creates an admin/owner account for the admin panel
// Usage: npx prisma db seed
// Or:   node prisma/seed.ts (with tsx)
// ============================================================

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const SALT_ROUNDS = 12

async function main() {
  console.log('🌱 Seeding database...\n')

  // ─── Admin/Owner Account ─────────────────────────────
  const adminEmail = 'admin@freshmart.co.uk'
  const adminPassword = 'Admin@2026'
  const adminName = 'Store Owner'

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (existingAdmin) {
    // Update existing user to owner role
    const updated = await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { role: 'owner', name: adminName },
    })
    console.log(`✅ Updated existing user to owner: ${updated.email} (role: ${updated.role})`)
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS)
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        passwordHash,
        role: 'owner',
      },
    })
    console.log(`✅ Created owner account: ${admin.email} (role: ${admin.role})`)
  }

  // ─── Demo Customer Account (optional) ────────────────
  const customerEmail = 'customer@freshmart.co.uk'
  const customerPassword = 'Customer@2026'

  const existingCustomer = await prisma.user.findUnique({
    where: { email: customerEmail },
  })

  if (existingCustomer) {
    console.log(`ℹ️  Customer already exists: ${customerEmail}`)
  } else {
    const passwordHash = await bcrypt.hash(customerPassword, SALT_ROUNDS)
    const customer = await prisma.user.create({
      data: {
        email: customerEmail,
        name: 'Demo Customer',
        passwordHash,
        role: 'customer',
      },
    })
    console.log(`✅ Created customer account: ${customer.email} (role: ${customer.role})`)
  }

  // ─── Summary ──────────────────────────────────────────
  console.log('\n📋 Account Summary:')
  console.log('─────────────────────────────────────────')
  console.log(`  👤 Owner:   ${adminEmail} / ${adminPassword}`)
  console.log(`  👤 Customer: ${customerEmail} / ${customerPassword}`)
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
