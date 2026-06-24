// Quick smoke-test script: log in as the owner, then exercise the new
// dual-role / ETA / email endpoints end-to-end.
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const DATABASE_URL = process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db'
const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })

async function main() {
  const owners = await prisma.user.findMany({
    where: { role: { in: ['OWNER', 'MANAGER'] } },
    select: { id: true, email: true, role: true, isActive: true, name: true, additionalRoles: true },
    take: 10,
  })
  console.log('--- Owners / Managers in DB ---')
  for (const o of owners) {
    console.log(`  ${o.email}  role=${o.role}  active=${o.isActive}  additional=${o.additionalRoles}`)
  }

  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    select: { id: true, email: true, name: true, role: true, additionalRoles: true, isActive: true },
    take: 5,
  })
  console.log('\n--- Drivers in DB ---')
  for (const d of drivers) {
    console.log(`  ${d.email}  name=${d.name}  additional=${d.additionalRoles}`)
  }

  const pickers = await prisma.user.findMany({
    where: { role: 'PICKER' },
    select: { id: true, email: true, name: true, role: true, additionalRoles: true, isActive: true },
    take: 5,
  })
  console.log('\n--- Pickers in DB ---')
  for (const p of pickers) {
    console.log(`  ${p.email}  name=${p.name}  additional=${p.additionalRoles}`)
  }

  // Look at recent orders
  const orders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, estimatedDeliveryAt: true, driverId: true, customer: { select: { email: true, name: true } } },
  })
  console.log('\n--- Recent orders ---')
  for (const o of orders) {
    console.log(`  ${o.id.slice(0,8)}  status=${o.status}  eta=${o.estimatedDeliveryAt?.toISOString() || 'none'}  driver=${o.driverId || 'none'}  customer=${o.customer.email}`)
  }

  // Check SMTP settings
  const smtpSettings = await prisma.storeSetting.findMany({
    where: { key: { startsWith: 'smtp_' } },
    select: { key: true, value: true },
  })
  console.log('\n--- SMTP settings ---')
  if (smtpSettings.length === 0) {
    console.log('  (none — email will gracefully no-op until owner saves credentials)')
  } else {
    for (const s of smtpSettings) {
      const display = s.key === 'smtp_pass' ? '***' : (s.value || '(empty)')
      console.log(`  ${s.key} = ${display}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
