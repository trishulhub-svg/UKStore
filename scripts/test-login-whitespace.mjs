// Regression test for Task 9 (follow-up): login should succeed even when
// the email has leading/trailing whitespace.
//
// Bug: The login route was calling `email.toLowerCase()` but NOT `.trim()`.
// When a mobile keyboard auto-inserted a leading/trailing space (common
// after autocorrect), the DB lookup returned null and the user saw
// "Invalid email or password" even though the email was correct.
//
// Fix: The login route now trims AND lowercases the email. The register
// route, auth-client.ts, and all three login form components also trim
// defensively.
//
// This test verifies:
//   1. Login with "email" (no whitespace) works
//   2. Login with " email" (leading space) works
//   3. Login with "email " (trailing space) works
//   4. Login with " email " (both) works
//   5. Login with "Email" (capitalized) works
//   6. Login with "  email  " (multiple spaces) works
//   7. Login with tab characters around email works
//   8. Login with newline characters around email works

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'admin@freshmart.co.uk'
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Admin@2026'

async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return {
    status: res.status,
    data: await res.json(),
  }
}

let passed = 0
let failed = 0

function assert(label, condition, details = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label} ${details}`)
    failed++
  }
}

console.log(`\n=== Login Email Whitespace Regression Test ===`)
console.log(`Testing with email: ${OWNER_EMAIL}`)
console.log(`Password: ${OWNER_PASSWORD}`)

// 1. Baseline — no whitespace
console.log(`\n--- Test 1: No whitespace ---`)
let r = await login(OWNER_EMAIL, OWNER_PASSWORD)
assert('Login succeeds with clean email', r.status === 200, `got ${r.status}`)

// 2. Leading space
console.log(`\n--- Test 2: Leading space (" ${OWNER_EMAIL}") ---`)
r = await login(` ${OWNER_EMAIL}`, OWNER_PASSWORD)
assert('Login succeeds with leading space', r.status === 200, `got ${r.status} ${JSON.stringify(r.data).substring(0, 200)}`)

// 3. Trailing space
console.log(`\n--- Test 3: Trailing space ("${OWNER_EMAIL} ") ---`)
r = await login(`${OWNER_EMAIL} `, OWNER_PASSWORD)
assert('Login succeeds with trailing space', r.status === 200, `got ${r.status}`)

// 4. Both leading and trailing space
console.log(`\n--- Test 4: Leading + trailing space ---`)
r = await login(` ${OWNER_EMAIL} `, OWNER_PASSWORD)
assert('Login succeeds with leading + trailing space', r.status === 200, `got ${r.status}`)

// 5. Capitalized email
console.log(`\n--- Test 5: Capitalized email ---`)
r = await login(OWNER_EMAIL.toUpperCase(), OWNER_PASSWORD)
assert('Login succeeds with uppercase email', r.status === 200, `got ${r.status}`)

// 6. Multiple spaces
console.log(`\n--- Test 6: Multiple spaces ("  ${OWNER_EMAIL}  ") ---`)
r = await login(`  ${OWNER_EMAIL}  `, OWNER_PASSWORD)
assert('Login succeeds with multiple spaces', r.status === 200, `got ${r.status}`)

// 7. Tab characters
console.log(`\n--- Test 7: Tab characters ("\\t${OWNER_EMAIL}\\t") ---`)
r = await login(`\t${OWNER_EMAIL}\t`, OWNER_PASSWORD)
assert('Login succeeds with tab characters', r.status === 200, `got ${r.status}`)

// 8. Newline characters
console.log(`\n--- Test 8: Newline characters ("\\n${OWNER_EMAIL}\\n") ---`)
r = await login(`\n${OWNER_EMAIL}\n`, OWNER_PASSWORD)
assert('Login succeeds with newline characters', r.status === 200, `got ${r.status}`)

// 9. Verify the response email is clean (no whitespace)
console.log(`\n--- Test 9: Response email is clean ---`)
r = await login(` ${OWNER_EMAIL} `, OWNER_PASSWORD)
assert(
  'Response email has no whitespace',
  r.data?.user?.email === OWNER_EMAIL,
  `got "${r.data?.user?.email}"`
)

// 10. Wrong password still fails (verify we didn't break password checking)
console.log(`\n--- Test 10: Wrong password still fails ---`)
r = await login(OWNER_EMAIL, 'WrongPassword123!')
assert('Login fails with wrong password', r.status === 401, `got ${r.status}`)
assert(
  'Error is "Password verification failed" (not "No user found")',
  (r.data?.technicalError?.details || '').includes('Password verification failed'),
  `got: ${r.data?.technicalError?.details}`
)

// 11. Non-existent email still fails
console.log(`\n--- Test 11: Non-existent email still fails ---`)
r = await login('nonexistent@example.com', OWNER_PASSWORD)
assert('Login fails with non-existent email', r.status === 401, `got ${r.status}`)

console.log(`\n=== Summary ===`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)

if (failed > 0) process.exit(1)
