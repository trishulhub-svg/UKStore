/**
 * Test script: verify that the dual-role driver filter correctly
 * catches employees whose primary role is NOT driver but who have
 * DRIVER in their additionalRoles JSON column.
 *
 * Run: npx tsx scripts/test-dual-role-drivers.ts
 */
import { getPrisma } from '../src/lib/auth/prisma'

async function main() {
  const prisma = await getPrisma()

  // Old (buggy) filter
  const oldFilter = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    select: { id: true, name: true, email: true, role: true, additionalRoles: true },
  })
  console.log(`\n[OLD] Primary role = DRIVER → ${oldFilter.length} user(s)`)
  for (const u of oldFilter) {
    console.log(`  - ${u.name} <${u.email}>  role=${u.role}  additionalRoles=${u.additionalRoles}`)
  }

  // New filter
  const newFilter = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'DRIVER' },
        { additionalRoles: { contains: '"DRIVER"' } },
      ],
    },
    select: { id: true, name: true, email: true, role: true, additionalRoles: true },
  })
  console.log(`\n[NEW] Primary=DRIVER OR additionalRoles contains DRIVER → ${newFilter.length} user(s)`)
  for (const u of newFilter) {
    console.log(`  - ${u.name} <${u.email}>  role=${u.role}  additionalRoles=${u.additionalRoles}`)
  }

  // Diff
  const oldIds = new Set(oldFilter.map((u) => u.id))
  const newlyVisible = newFilter.filter((u) => !oldIds.has(u.id))
  console.log(`\n[DIFF] Dual-role drivers newly visible with the fix: ${newlyVisible.length}`)
  for (const u of newlyVisible) {
    console.log(`  + ${u.name} <${u.email}>  (primary role: ${u.role})`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
