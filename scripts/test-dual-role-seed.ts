/**
 * Test script: seed a dual-role PICKER+DRIVER employee, then verify
 * the new driver-list filter catches them.
 *
 * Run: npx tsx scripts/test-dual-role-seed.ts
 */
import bcrypt from 'bcryptjs'
import { getPrisma } from '../src/lib/auth/prisma'

async function main() {
  const prisma = await getPrisma()
  const STORE_ID = 'store-fresh-mart-001'

  const email = 'dualrole-test@freshmart.co.uk'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Test user already exists: ${email}, deleting and recreating...`)
    await prisma.driverProfile.deleteMany({ where: { userId: existing.id } })
    await prisma.employeeProfile.deleteMany({ where: { userId: existing.id } })
    await prisma.user.delete({ where: { id: existing.id } })
  }

  const passwordHash = await bcrypt.hash('Test@2026', 12)
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Dual Role Test User',
      passwordHash,
      role: 'PICKER',                                  // primary role
      additionalRoles: JSON.stringify(['DRIVER']),     // additional role
      isActive: true,
      mustResetPassword: false,
    },
  })

  // Create driver profile so they show up properly in driver UI
  await prisma.driverProfile.create({
    data: {
      userId: user.id,
      vehicleType: 'bicycle',
      verificationStatus: 'approved',
    },
  })

  // Also create employee profile (use minimal fields — actual schema
  // fields are salary/wageRate/wageType, not salaryType/hourlyRate)
  await prisma.employeeProfile.create({
    data: {
      userId: user.id,
      wageType: 'hourly',
      wageRate: 12.5,
    },
  })

  console.log(`\nCreated dual-role test user: ${user.email}`)
  console.log(`  role=${user.role}  additionalRoles=${user.additionalRoles}`)

  // Run the NEW filter
  const newFilter = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'DRIVER' },
        { additionalRoles: { contains: '"DRIVER"' } },
      ],
    },
    select: { id: true, name: true, email: true, role: true, additionalRoles: true },
  })
  console.log(`\n[NEW filter] ${newFilter.length} user(s) match:`)
  for (const u of newFilter) {
    console.log(`  - ${u.name} <${u.email}>  role=${u.role}  additionalRoles=${u.additionalRoles}`)
  }

  // Run the OLD filter for comparison
  const oldFilter = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    select: { id: true, name: true, email: true, role: true, additionalRoles: true },
  })
  console.log(`\n[OLD filter] ${oldFilter.length} user(s) match:`)
  for (const u of oldFilter) {
    console.log(`  - ${u.name} <${u.email}>  role=${u.role}`)
  }

  const found = newFilter.find((u) => u.email === email)
  if (found) {
    console.log('\n✅ PASS: dual-role user IS in the new filter result')
  } else {
    console.log('\n❌ FAIL: dual-role user NOT in the new filter result')
    process.exit(1)
  }

  // Clean up the test user
  await prisma.driverProfile.deleteMany({ where: { userId: user.id } })
  await prisma.employeeProfile.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
  console.log('\nCleaned up test user.')

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
