// Quick verification: ensure getRoleBasedRedirectFromRoles sends every
// role combination to the correct dashboard.
//
// NEW BEHAVIOUR (Task 15): Primary role wins.
//   - Primary PICKER → /picker (always, even with MANAGER additional role)
//   - Primary DRIVER → /driver (always, even with MANAGER additional role)
//   - Primary MANAGER/OWNER → /admin
//   - Primary CUSTOMER → / (but check additional roles for dual-role customers)
//
// Run with: node scripts/test-admin-redirect.mjs

function getRoleBasedRedirectFromRoles(primaryRole, additionalRoles = []) {
  const primary = (primaryRole || '').toLowerCase().trim()

  if (primary === 'owner' || primary === 'manager') return '/admin'
  if (primary === 'driver') return '/driver'
  if (primary === 'picker') return '/picker'

  // Customer fallback: check additional roles
  const additional = (additionalRoles || [])
    .map((r) => (r || '').toLowerCase().trim())
    .filter(Boolean)

  if (additional.some((r) => r === 'owner' || r === 'manager')) return '/admin'
  if (additional.includes('driver')) return '/driver'
  if (additional.includes('picker')) return '/picker'
  return '/'
}

const cases = [
  // [primary, additionalRoles[], expectedRedirect, description]
  ['OWNER',    [],           '/admin',  'Pure owner → /admin'],
  ['MANAGER',  [],           '/admin',  'Pure manager → /admin'],
  ['DRIVER',   [],           '/driver', 'Pure driver → /driver'],
  ['PICKER',   [],           '/picker', 'Pure picker → /picker'],
  ['CUSTOMER', [],           '/',       'Pure customer → /'],

  // ─── NEW: Primary role wins ───────────────────────────────────
  // A picker/driver always goes to their own dashboard, even if they
  // have MANAGER/OWNER in additionalRoles. Their admin features are
  // linked from their own dashboard, not a redirect to /admin.
  ['PICKER',   ['MANAGER'],  '/picker', 'PICKER + MANAGER → /picker (primary wins, NEW Task 15)'],
  ['DRIVER',   ['MANAGER'],  '/driver', 'DRIVER + MANAGER → /driver (primary wins, NEW Task 15)'],
  ['PICKER',   ['OWNER'],    '/picker', 'PICKER + OWNER → /picker (primary wins, NEW Task 15)'],
  ['DRIVER',   ['OWNER'],    '/driver', 'DRIVER + OWNER → /driver (primary wins, NEW Task 15)'],

  // Admin primary roles still go to /admin
  ['MANAGER',  ['DRIVER'],   '/admin',  'MANAGER + DRIVER → /admin (primary wins)'],
  ['MANAGER',  ['PICKER'],   '/admin',  'MANAGER + PICKER → /admin (primary wins)'],
  ['OWNER',    ['DRIVER','PICKER'], '/admin', 'OWNER + DRIVER + PICKER → /admin'],

  // Case-insensitivity
  ['owner',    [],           '/admin',  'lowercase owner → /admin'],
  ['Picker',   ['Manager'],  '/picker', 'mixed-case PICKER + MANAGER → /picker (primary wins)'],

  // Non-admin dual roles: primary wins
  ['PICKER',   ['DRIVER'],   '/picker', 'PICKER + DRIVER → /picker (primary wins, NEW Task 15)'],
  ['DRIVER',   ['PICKER'],   '/driver', 'DRIVER + PICKER → /driver (primary wins, NEW Task 15)'],

  // Customer with additional roles: additional roles determine destination
  ['CUSTOMER', ['PICKER'],   '/picker', 'CUSTOMER + PICKER → /picker (customer fallback)'],
  ['CUSTOMER', ['DRIVER'],   '/driver', 'CUSTOMER + DRIVER → /driver (customer fallback)'],
  ['CUSTOMER', ['MANAGER'],  '/admin',  'CUSTOMER + MANAGER → /admin (customer fallback)'],
]

let failures = 0
for (const [primary, additional, expected, desc] of cases) {
  const actual = getRoleBasedRedirectFromRoles(primary, additional)
  const ok = actual === expected
  console.log(`${ok ? '✓' : '✗'} ${desc}  [primary=${primary}, additional=${JSON.stringify(additional)}] → ${actual}${ok ? '' : ` (expected ${expected})'`}`)
  if (!ok) failures++
}

// Specific check: picker/driver should NEVER redirect to /admin
const pickerDriverCases = cases.filter(([primary]) =>
  ['PICKER', 'DRIVER'].includes(String(primary).toUpperCase())
)
const pickerDriverBugs = pickerDriverCases.filter(([primary, additional]) => {
  const actual = getRoleBasedRedirectFromRoles(primary, additional)
  return actual === '/admin'
})

console.log('')
if (pickerDriverBugs.length === 0) {
  console.log(`✓ PASS: No picker/driver primary role ever redirects to /admin`)
} else {
  console.log(`✗ FAIL: ${pickerDriverBugs.length} picker/driver case(s) redirected to /admin:`)
  pickerDriverBugs.forEach(([primary, additional]) => {
    console.log(`    primary=${primary}, additional=${JSON.stringify(additional)}`)
  })
  failures += pickerDriverBugs.length
}

console.log('')
if (failures === 0) {
  console.log(`✓ All ${cases.length} redirect cases passed.`)
  process.exit(0)
} else {
  console.log(`✗ ${failures} failure(s) out of ${cases.length} cases.`)
  process.exit(1)
}
