// Clean up test data created during the smoke test.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } })

async function main() {
  // Delete the test order (cascade will delete its items)
  const testOrder = await prisma.order.findFirst({
    where: { customer: { email: 'test-customer@freshmart.local' } },
    select: { id: true },
  })
  if (testOrder) {
    await prisma.order.delete({ where: { id: testOrder.id } })
    console.log(`Deleted test order: ${testOrder.id}`)
  }

  // Delete the test customer (cascade will delete address, sessions, notifications)
  const testCustomer = await prisma.user.findUnique({ where: { email: 'test-customer@freshmart.local' } })
  if (testCustomer) {
    // Manually delete related rows first to satisfy FK constraints
    await prisma.address.deleteMany({ where: { userId: testCustomer.id } })
    await prisma.session.deleteMany({ where: { userId: testCustomer.id } })
    await prisma.notification.deleteMany({ where: { userId: testCustomer.id } })
    await prisma.favourite.deleteMany({ where: { userId: testCustomer.id } })
    await prisma.user.delete({ where: { id: testCustomer.id } })
    console.log(`Deleted test customer: ${testCustomer.id}`)
  }

  // Reset driver's additionalRoles back to '[]' (we added PICKER during smoke test)
  const driver = await prisma.user.findUnique({ where: { email: 'driver@freshmart.co.uk' }, select: { id: true, additionalRoles: true } })
  if (driver && driver.additionalRoles !== '[]') {
    await prisma.user.update({ where: { id: driver.id }, data: { additionalRoles: '[]' } })
    console.log(`Reset driver ${driver.id} additionalRoles to []`)
  } else {
    console.log('Driver additionalRoles already empty')
  }

  await prisma.$disconnect()
  console.log('Cleanup complete')
}

main().catch(err => { console.error(err); process.exit(1) })
