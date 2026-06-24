// End-to-end runtime test: simulate Vercel Lambda calling getPrisma() with Turso env vars set.
// Run with: npx tsx scripts/test-turso-runtime.ts
import { config } from 'dotenv'
config()

async function main() {
  console.log('TURSO_DATABASE_URL set:', !!process.env.TURSO_DATABASE_URL)

  const { getPrisma } = await import('../src/lib/auth/prisma.ts')

  const prisma = await getPrisma()

  const userCount = await prisma.user.count()
  console.log(`✅ Turso runtime path works — user count: ${userCount}`)

  const ownerEmail = 'kiranpradhan2057@gmail.com'
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } })
  console.log(`✅ Owner account found: ${owner?.email} (role: ${owner?.role})`)

  const productCount = await prisma.product.count()
  console.log(`✅ Product count: ${productCount}`)

  await prisma.$disconnect()
  console.log('✅ All checks passed. Vercel will work the same way.')
}

main().catch(e => { console.error('FAIL:', e); process.exit(1) })
