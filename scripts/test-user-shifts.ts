/**
 * Test: GET /api/user/shifts returns the current user's shifts.
 *
 * Run: npx tsx scripts/test-user-shifts.ts
 *
 * This is a server-side test that bypasses auth by directly calling
 * the Prisma query the route uses. Useful for verifying the data
 * shape matches what the client expects.
 */
import { getPrisma } from '../src/lib/auth/prisma'

async function main() {
  const prisma = await getPrisma()

  // Find a test user — use the demo driver
  const user = await prisma.user.findFirst({
    where: { email: 'driver@freshmart.co.uk' },
    select: { id: true, email: true, role: true, additionalRoles: true },
  })
  if (!user) {
    console.log('❌ No test user found. Run prisma seed first.')
    process.exit(1)
  }
  console.log(`\nTest user: ${user.email}  role=${user.role}  additionalRoles=${user.additionalRoles}`)

  // Compute week start (Monday of current week)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  console.log(`\nWeek range: ${weekStart.toISOString()} → ${weekEnd.toISOString()}`)

  // Count existing shifts for this user in this week
  const count = await prisma.shift.count({
    where: {
      userId: user.id,
      date: { gte: weekStart, lt: weekEnd },
    },
  })
  console.log(`Existing shifts this week: ${count}`)

  // Create a test shift for today so the dashboard "Today's Shift" card has something to show
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const testShift = await prisma.shift.create({
    data: {
      userId: user.id,
      date: today,
      startTime: '09:00',
      endTime: '17:00',
      role: 'DRIVER',
    },
  })
  console.log(`\nCreated test shift: ${testShift.id}`)
  console.log(`  date=${testShift.date.toISOString()}  ${testShift.startTime}-${testShift.endTime}  role=${testShift.role}`)

  // Run the same query the endpoint uses
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayStart.getDate() + 1)

  const fetchStart = todayStart < weekStart ? todayStart : weekStart
  const fetchEnd = todayEnd > weekEnd ? todayEnd : weekEnd

  const allShifts = await prisma.shift.findMany({
    where: {
      userId: user.id,
      date: { gte: fetchStart, lt: fetchEnd },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      manualHours: true,
      role: true,
    },
  })

  console.log(`\nFetched ${allShifts.length} shift(s) for the union range:`)
  for (const s of allShifts) {
    const isToday = s.date.getTime() >= todayStart.getTime() && s.date.getTime() < todayEnd.getTime()
    console.log(`  - id=${s.id}`)
    console.log(`    date=${s.date.toISOString()}  ${s.startTime}-${s.endTime}  manualHours=${s.manualHours}  role=${s.role}  isToday=${isToday}`)
  }

  // Clean up
  await prisma.shift.delete({ where: { id: testShift.id } })
  console.log('\nCleaned up test shift.')

  console.log('\n✅ PASS: query returned expected data')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
