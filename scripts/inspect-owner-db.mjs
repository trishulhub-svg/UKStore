// Debug: dump the current state of the owner user account(s) in the DB.
// We want to see: id, email, name, role, isActive, mustResetPassword,
// passwordHash (truncated), createdAt, updatedAt.
//
// This will tell us:
// - Does kiranpradhan2057@gmail.com exist as a user?
// - Does it have a passwordHash set?
// - Was the email actually changed (updatedAt newer than createdAt)?
// - Was mustResetPassword flipped?

import { PrismaClient } from '@prisma/client'
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

console.log('\n=== All OWNER users in DB ===')
const owners = await prisma.user.findMany({
  where: { role: 'OWNER' },
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
for (const o of owners) {
  console.log({
    id: o.id,
    email: o.email,
    name: o.name,
    role: o.role,
    isActive: o.isActive,
    mustResetPassword: o.mustResetPassword,
    passwordHash: o.passwordHash ? `${o.passwordHash.substring(0, 30)}... (length=${o.passwordHash.length})` : 'NULL',
    passwordHashType: o.passwordHash ? (o.passwordHash.startsWith('$2') ? 'bcrypt' : (o.passwordHash.startsWith('scrypt:') ? 'scrypt' : 'unknown')) : 'none',
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    ageMs: Date.now() - o.updatedAt.getTime(),
  })
}

console.log('\n=== User with email kiranpradhan2057@gmail.com (any role) ===')
const kiran = await prisma.user.findUnique({
  where: { email: 'kiranpradhan2057@gmail.com' },
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
console.log(kiran ? {
  id: kiran.id,
  email: kiran.email,
  name: kiran.name,
  role: kiran.role,
  isActive: kiran.isActive,
  mustResetPassword: kiran.mustResetPassword,
  passwordHash: kiran.passwordHash ? `${kiran.passwordHash.substring(0, 30)}... (length=${kiran.passwordHash.length})` : 'NULL',
  passwordHashType: kiran.passwordHash ? (kiran.passwordHash.startsWith('$2') ? 'bcrypt' : (kiran.passwordHash.startsWith('scrypt:') ? 'scrypt' : 'unknown')) : 'none',
  createdAt: kiran.createdAt.toISOString(),
  updatedAt: kiran.updatedAt.toISOString(),
} : 'NOT FOUND')

console.log('\n=== Users created or updated in the last 24 hours ===')
const recent = await prisma.user.findMany({
  where: { updatedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
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
  orderBy: { updatedAt: 'desc' },
  take: 20,
})
for (const u of recent) {
  console.log({
    id: u.id,
    email: u.email,
    role: u.role,
    mustResetPassword: u.mustResetPassword,
    passwordHash: u.passwordHash ? `${u.passwordHash.substring(0, 30)}... (length=${u.passwordHash.length})` : 'NULL',
    updatedAt: u.updatedAt.toISOString(),
    ageMs: Date.now() - u.updatedAt.getTime(),
  })
}

await prisma.$disconnect()
