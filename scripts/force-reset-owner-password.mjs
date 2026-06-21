// Force-reset the OWNER password hash to a FRESH bcrypt hash of "Admin@2026"
// and ensure the email is exactly "kiranpradhan2057@gmail.com".
// Run against BOTH databases to cover both possible deployment paths.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import path from 'path'

const DB_PATHS = [
  'file:/home/z/my-project/db/custom.db',
  'file:/tmp/my-project/db/custom.db',
]

const TARGET_EMAIL = 'kiranpradhan2057@gmail.com'
const TARGET_PASSWORD = 'Admin@2026'

for (const dbUrl of DB_PATHS) {
  console.log(`\n========== ${dbUrl} ==========`)
  process.env.DATABASE_URL = dbUrl

  // Force Prisma to re-instantiate for each DB
  const { PrismaClient: PrismaClient2 } = await import('@prisma/client')
  const prisma = new PrismaClient2()

  try {
    // Check DB connectivity
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (e) {
      console.log(`  DB not accessible: ${e.message}`)
      continue
    }

    // Find OWNER user(s)
    const owners = await prisma.user.findMany({
      where: { role: { in: ['OWNER', 'MANAGER'] } },
    })
    console.log(`  Found ${owners.length} OWNER/MANAGER user(s):`)
    for (const u of owners) {
      console.log(`    - id=${u.id} email=${u.email} role=${u.role} isActive=${u.isActive} mustReset=${u.mustResetPassword} hash=${u.passwordHash?.slice(0, 20)}...`)
    }

    // Generate a FRESH hash (don't reuse any existing hash)
    const freshHash = await bcrypt.hash(TARGET_PASSWORD, 12)
    console.log(`  New fresh hash: ${freshHash}`)

    // Verify the fresh hash works
    const verifyNew = await bcrypt.compare(TARGET_PASSWORD, freshHash)
    console.log(`  Verify fresh hash against "${TARGET_PASSWORD}": ${verifyNew}`)
    if (!verifyNew) {
      console.log(`  !! Fresh hash verification FAILED, skipping this DB`)
      continue
    }

    // Update ALL owner/manager users to the target email + fresh hash
    for (const u of owners) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          email: TARGET_EMAIL,
          passwordHash: freshHash,
          isActive: true,
          mustResetPassword: false,
        },
      })
      console.log(`  Updated user ${u.id} -> email=${TARGET_EMAIL}, freshHash, isActive=true, mustReset=false`)
    }

    // If NO owners found at all, that's a problem — print all users
    if (owners.length === 0) {
      const allUsers = await prisma.user.findMany({ take: 20 })
      console.log(`  !! No OWNER/MANAGER users found. All users in DB:`)
      for (const u of allUsers) {
        console.log(`    - id=${u.id} email=${u.email} role=${u.role}`)
      }
    }

    // Final verification: read back the user and verify password
    const finalUser = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } })
    if (finalUser) {
      const finalVerify = await bcrypt.compare(TARGET_PASSWORD, finalUser.passwordHash)
      console.log(`\n  FINAL VERIFICATION:`)
      console.log(`    email: ${finalUser.email}`)
      console.log(`    role: ${finalUser.role}`)
      console.log(`    isActive: ${finalUser.isActive}`)
      console.log(`    mustResetPassword: ${finalUser.mustResetPassword}`)
      console.log(`    password verify: ${finalVerify}`)
    } else {
      console.log(`  !! Final lookup failed — user not found after update`)
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`)
    console.log(e.stack)
  } finally {
    await prisma.$disconnect()
  }
}

console.log('\nDone.')
