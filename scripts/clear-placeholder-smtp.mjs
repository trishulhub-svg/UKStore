// Clear the placeholder SMTP credentials so the email system truly no-ops
// until the owner enters real credentials via the admin settings UI.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } })
const STORE_ID = 'store-fresh-mart-001'

async function main() {
  // Wipe the bogus placeholder values that were saved during prior testing.
  const result = await prisma.storeSetting.deleteMany({
    where: {
      storeId: STORE_ID,
      key: { startsWith: 'smtp_' },
    },
  })
  console.log(`Cleared ${result.count} placeholder SMTP settings rows`)

  // Verify
  const remaining = await prisma.storeSetting.findMany({
    where: { storeId: STORE_ID, key: { startsWith: 'smtp_' } },
  })
  console.log('Remaining SMTP settings:', remaining.length)

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
