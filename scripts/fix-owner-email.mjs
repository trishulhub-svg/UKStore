// Fix: ensure the OWNER account's email matches what the user expects
// (kiranpradhan2057@gmail.com) and verify the password hash matches Admin@2026.
//
// Why: Previous test scripts in this project were silently reverting the
// owner email back to the seed value `admin@freshmart.co.uk`. The user is
// trying to log in with kiranpradhan2057@gmail.com / Admin@2026 but the DB
// currently has the old seed email, so login fails with AUTH_INVALID_CREDENTIALS.
//
// This script:
//   1. Finds the OWNER user (any role: OWNER or ADMIN).
//   2. Verifies the current password hash matches Admin@2026 (using bcrypt).
//      - If not, sets a fresh bcrypt hash for Admin@2026.
//   3. Sets the email to kiranpradhan2057@gmail.com (case-insensitive).
//   4. Sets mustResetPassword=false, isActive=true so login is not blocked.
//   5. Prints the final state so we can confirm.

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'

// Load .env manually
const envFile = fs.readFileSync('/home/z/my-project/.env', 'utf-8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const prisma = new PrismaClient()
const TARGET_EMAIL = 'kiranpradhan2057@gmail.com'
const TARGET_PASSWORD = 'Admin@2026'

console.log('\n=== Step 1: Find existing OWNER/ADMIN user(s) ===')
const admins = await prisma.user.findMany({
  where: { role: { in: ['OWNER', 'MANAGER'] } },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    mustResetPassword: true,
    passwordHash: true,
    createdAt: true,
    updatedAt: true,
  },
})
console.log(`Found ${admins.length} admin-level user(s):`)
for (const u of admins) {
  console.log({
    id: u.id,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    mustResetPassword: u.mustResetPassword,
    passwordHashType: u.passwordHash
      ? u.passwordHash.startsWith('$2')
        ? 'bcrypt'
        : u.passwordHash.startsWith('scrypt:')
        ? 'scrypt'
        : 'unknown'
      : 'NULL',
    updatedAt: u.updatedAt.toISOString(),
  })
}

// Prefer OWNER role; otherwise pick first ADMIN
const target =
  admins.find((u) => u.role === 'OWNER') ?? admins[0]

if (!target) {
  console.error('\nFATAL: No OWNER or ADMIN user found in DB. Cannot proceed.')
  process.exit(1)
}

console.log(`\n=== Step 2: Targeting user ${target.id} (${target.email}, role=${target.role}) ===`)

console.log('\n=== Step 3: Verify current password hash against Admin@2026 ===')
let passwordOk = false
if (target.passwordHash && target.passwordHash.startsWith('$2')) {
  try {
    passwordOk = await bcrypt.compare(TARGET_PASSWORD, target.passwordHash)
  } catch (e) {
    console.log('bcrypt.compare threw:', e.message)
  }
}
console.log(`Password matches Admin@2026? ${passwordOk ? 'YES' : 'NO'}`)

let newHash = target.passwordHash
if (!passwordOk) {
  console.log('Re-hashing password to Admin@2026 (bcrypt, cost 12)')
  newHash = await bcrypt.hash(TARGET_PASSWORD, 12)
  console.log(`New hash: ${newHash.substring(0, 30)}... (length=${newHash.length})`)
  // Verify the new hash
  const verify = await bcrypt.compare(TARGET_PASSWORD, newHash)
  console.log(`New hash verify: ${verify ? 'OK' : 'FAIL'}`)
}

console.log(`\n=== Step 4: Updating email to ${TARGET_EMAIL} (and password/flags if needed) ===`)
const updated = await prisma.user.update({
  where: { id: target.id },
  data: {
    email: TARGET_EMAIL,
    passwordHash: newHash,
    mustResetPassword: false,
    isActive: true,
  },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    mustResetPassword: true,
    passwordHash: true,
    updatedAt: true,
  },
})
console.log('Updated user:')
console.log({
  id: updated.id,
  email: updated.email,
  name: updated.name,
  role: updated.role,
  isActive: updated.isActive,
  mustResetPassword: updated.mustResetPassword,
  passwordHashType: updated.passwordHash.startsWith('$2') ? 'bcrypt' : 'unknown',
  updatedAt: updated.updatedAt.toISOString(),
})

console.log('\n=== Step 5: Final verification (re-fetch from DB) ===')
const finalUser = await prisma.user.findUnique({
  where: { email: TARGET_EMAIL },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    isActive: true,
    mustResetPassword: true,
    passwordHash: true,
  },
})
if (!finalUser) {
  console.error('FATAL: After update, kiranpradhan2057@gmail.com not found in DB!')
  process.exit(1)
}
const finalVerify = await bcrypt.compare(TARGET_PASSWORD, finalUser.passwordHash)
console.log('Final DB state:')
console.log({
  id: finalUser.id,
  email: finalUser.email,
  role: finalUser.role,
  isActive: finalUser.isActive,
  mustResetPassword: finalUser.mustResetPassword,
  passwordMatchesAdmin2026: finalVerify,
})

if (!finalVerify) {
  console.error('FATAL: Password verification failed in DB!')
  process.exit(1)
}

console.log('\n=== ALL CHECKS PASSED ===')
console.log(`Owner email is now: ${finalUser.email}`)
console.log(`Password "Admin@2026" verifies: ${finalVerify}`)
console.log(`Login should work with: ${finalUser.email} / Admin@2026`)

await prisma.$disconnect()
