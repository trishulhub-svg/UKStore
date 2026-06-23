// Reset demo driver's password to "Admin@2026" so we can smoke-test login.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } })

async function main() {
  const hash = await bcrypt.hash('Admin@2026', 12)
  const u = await prisma.user.update({
    where: { email: 'driver@freshmart.co.uk' },
    data: { passwordHash: hash, mustResetPassword: false, isActive: true },
    select: { id: true, email: true, role: true, additionalRoles: true, isActive: true, mustResetPassword: true },
  })
  console.log('Driver password reset:', u)

  // Verify
  const ok = await bcrypt.compare('Admin@2026', hash)
  console.log('Verify Admin@2026 against new hash:', ok)
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
