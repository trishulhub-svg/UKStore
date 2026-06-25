// Clean up test orders + receipt test artifacts from the dev DB.
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Delete the test order created by test-receipt-flow.ts
  const deleted = await prisma.order.deleteMany({
    where: {
      OR: [
        { customer: { email: 'receipt-test@example.com' } },
        { stripeSessionId: { startsWith: 'test-' } },
      ],
    },
  })
  console.log(`Deleted ${deleted.count} test order(s)`)

  // Also clean up test users + addresses
  const deletedAddrs = await prisma.address.deleteMany({
    where: { addressLine1: '123 Test Street' },
  })
  console.log(`Deleted ${deletedAddrs.count} test address(es)`)

  const deletedUsers = await prisma.user.deleteMany({
    where: { email: 'receipt-test@example.com' },
  })
  console.log(`Deleted ${deletedUsers.count} test user(s)`)
}

main().finally(() => prisma.$disconnect())
