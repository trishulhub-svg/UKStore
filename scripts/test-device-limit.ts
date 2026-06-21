// Direct test of enforceDeviceLimit
import { getPrisma } from '@/lib/auth/prisma'
import { enforceDeviceLimit } from '@/lib/session-manager'

async function main() {
const prisma = await getPrisma()

// Find a driver user (not the test driver we just created)
const driver = await prisma.user.findFirst({ where: { role: 'DRIVER', email: 'driver@freshmart.co.uk' } })
console.log('Test driver:', driver.email, driver.id)

// Clean any existing test sessions
await prisma.session.deleteMany({ where: { userId: driver.id } })

const now = new Date()
const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

// Test 1: First login (desktop) — should be allowed, 0 existing
const result1 = await enforceDeviceLimit(driver.id, 'DRIVER', 'desktop')
console.log('Test 1 (first desktop login):', { allowed: result1.allowed, remaining: result1.remainingSessions.length })

// Create the desktop session
await prisma.session.create({ data: { userId: driver.id, tokenHash: 'test-desktop-hash', deviceType: 'desktop', deviceName: 'Test Desktop', expiresAt: expires } })

// Test 2: Second login (mobile) — should be allowed (1 desktop + 1 mobile)
const result2 = await enforceDeviceLimit(driver.id, 'DRIVER', 'mobile')
console.log('Test 2 (second mobile login):', { allowed: result2.allowed, remaining: result2.remainingSessions.length })

// Create the mobile session
await prisma.session.create({ data: { userId: driver.id, tokenHash: 'test-mobile-hash', deviceType: 'mobile', deviceName: 'Test Mobile', expiresAt: expires } })

// Test 3: Third login (tablet) — should be REJECTED
const result3 = await enforceDeviceLimit(driver.id, 'DRIVER', 'tablet')
console.log('Test 3 (third tablet login):', { allowed: result3.allowed, reason: result3.reason ? result3.reason.substring(0, 80) + '...' : undefined })

// Test 4: New desktop login — should REPLACE existing desktop
const result4 = await enforceDeviceLimit(driver.id, 'DRIVER', 'desktop')
console.log('Test 4 (replace desktop):', { allowed: result4.allowed, revokedSessionIds: result4.revokedSessionIds })
const remaining = await prisma.session.findMany({ where: { userId: driver.id } })
console.log('  Remaining sessions:', remaining.map(s => ({ type: s.deviceType, name: s.deviceName })))

// Test 5: Owner with 2 existing sessions — should revoke ALL
const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } })
await prisma.session.deleteMany({ where: { userId: owner.id, tokenHash: { contains: 'test-' } } })
await prisma.session.create({ data: { userId: owner.id, tokenHash: 'test-owner-1', deviceType: 'desktop', deviceName: 'Owner Desktop 1', expiresAt: expires } })
await prisma.session.create({ data: { userId: owner.id, tokenHash: 'test-owner-2', deviceType: 'mobile', deviceName: 'Owner Mobile', expiresAt: expires } })

const result5 = await enforceDeviceLimit(owner.id, 'OWNER', 'desktop')
console.log('Test 5 (owner replacement):', { allowed: result5.allowed, revokedCount: result5.revokedSessionIds.length })
const remainingOwner = await prisma.session.findMany({ where: { userId: owner.id, tokenHash: { contains: 'test-' } } })
console.log('  Remaining owner test sessions:', remainingOwner.length, '(expected 0)')

// Clean up
await prisma.session.deleteMany({ where: { userId: driver.id, tokenHash: { contains: 'test-' } } })
await prisma.session.deleteMany({ where: { userId: owner.id, tokenHash: { contains: 'test-' } } })
console.log('\n✓ All tests complete. Cleaned up test sessions.')

process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
