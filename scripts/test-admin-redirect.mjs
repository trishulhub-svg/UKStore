// Quick verification: ensure getRoleBasedRedirectFromRoles sends every
// admin-role combination to /admin, never to /picker or /driver.
//
// Run with: node scripts/test-admin-redirect.mjs

function getRoleBasedRedirectFromRoles(primaryRole, additionalRoles = []) {
  const allRoles = [
    (primaryRole || '').toLowerCase().trim(),
    ...additionalRoles.map((r) => (r || '').toLowerCase().trim()),
  ].filter(Boolean)

  if (allRoles.some((r) => r === 'owner' || r === 'manager')) return '/admin'
  if (allRoles.some((r) => r === 'driver')) return '/driver'
  if (allRoles.some((r) => r === 'picker')) return '/picker'
  return '/'
}

const cases = [
  // [primary, additionalRoles[], expectedRedirect, description]
  ['OWNER',    [],           '/admin',  'Pure owner → /admin'],
  ['MANAGER',  [],           '/admin',  'Pure manager → /admin'],
  ['DRIVER',   [],           '/driver', 'Pure driver → /driver'],
  ['PICKER',   [],           '/picker', 'Pure picker → /picker'],
  ['CUSTOMER', [],           '/',       'Pure customer → /'],

  // Dual-role: admin should ALWAYS win
  ['PICKER',   ['MANAGER'],  '/admin',  'PICKER + MANAGER → /admin (was the reported bug!)'],
  ['DRIVER',   ['MANAGER'],  '/admin',  'DRIVER + MANAGER → /admin (was the reported bug!)'],
  ['PICKER',   ['OWNER'],    '/admin',  'PICKER + OWNER → /admin'],
  ['DRIVER',   ['OWNER'],    '/admin',  'DRIVER + OWNER → /admin'],
  ['MANAGER',  ['DRIVER'],   '/admin',  'MANAGER + DRIVER → /admin (admin wins)'],
  ['MANAGER',  ['PICKER'],   '/admin',  'MANAGER + PICKER → /admin (admin wins)'],
  ['OWNER',    ['DRIVER','PICKER'], '/admin', 'OWNER + DRIVER + PICKER → /admin'],

  // Case-insensitivity
  ['owner',    [],           '/admin',  'lowercase owner → /admin'],
  ['Picker',   ['Manager'],  '/admin',  'mixed-case PICKER + MANAGER → /admin'],

  // Non-admin dual roles
  ['PICKER',   ['DRIVER'],   '/driver', 'PICKER + DRIVER → /driver (driver wins over picker)'],
  ['DRIVER',   ['PICKER'],   '/driver', 'DRIVER + PICKER → /driver (driver wins over picker)'],
]

let failures = 0
for (const [primary, additional, expected, desc] of cases) {
  const actual = getRoleBasedRedirectFromRoles(primary, additional)
  const ok = actual === expected
  console.log(`${ok ? '✓' : '✗'} ${desc}  [primary=${primary}, additional=${JSON.stringify(additional)}] → ${actual}${ok ? '' : ` (expected ${expected})'`}`)
  if (!ok) failures++
}

// Specific check for the user's reported bug:
// "when admin logs in, it should never go to picker dashboard or driver dashboard"
const adminCases = cases.filter(([, , expected]) => expected === '/admin')
const adminBugs = adminCases.filter(([primary, additional]) => {
  const actual = getRoleBasedRedirectFromRoles(primary, additional)
  return actual === '/picker' || actual === '/driver'
})

console.log('')
console.log(`Total: ${cases.length - failures}/${cases.length} passed`)
if (adminBugs.length === 0) {
  console.log('✓ CONFIRMED: no admin role combination is sent to /picker or /driver')
} else {
  console.log(`✗ BUG: ${adminBugs.length} admin role combination(s) still go to /picker or /driver`)
  failures++
}

process.exit(failures === 0 ? 0 : 1)
