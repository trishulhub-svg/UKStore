// Regression test for Task 9: owner changes their email via /admin/employees
// (NOT via /account/profile), then tries to log in with the new email.
//
// Bug we're guarding against:
//   In Task 7/8, the test scripts hard-coded "admin@freshmart.co.uk" as
//   the restore value. This silently overwrote the user's REAL email
//   change (e.g., kiranpradhan2057@gmail.com) back to admin@freshmart.co.uk.
//   When the user tried to log in with their real email, they got
//   "Invalid email or password" (looks like wrong password, actually
//   "user not found" because the email was reverted).
//
// This test verifies the ADMIN-SIDE email change flow:
//   1. Login as owner (OWNER_EMAIL / OWNER_PASSWORD env vars)
//   2. Save the original email
//   3. Use the /api/admin/employees/[id] PATCH route to change the email
//      (this is the path the user took in the bug report)
//   4. Verify the password is UNCHANGED (login with new email + old password)
//   5. Verify the email is the only thing that changed (name, role, etc. preserved)
//   6. Restore the original email
//   7. Verify login with original email + original password still works
//
// Usage:
//   OWNER_EMAIL=kiranpradhan2057@gmail.com OWNER_PASSWORD=Admin@2026 \
//     node scripts/test-admin-email-change.mjs

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'admin@freshmart.co.uk'
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Admin@2026'

function extractCookie(setCookie) {
  if (!setCookie) return ''
  const match = setCookie.match(/fresh_mart_session=([^;]+)/)
  return match ? match[1] : ''
}

async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  return {
    cookie: extractCookie(res.headers.get('set-cookie')),
    body: await res.json(),
  }
}

async function refreshCookie(cookie) {
  try {
    const res = await fetch('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `fresh_mart_session=${cookie}` },
    })
    if (res.ok) {
      const newCookie = extractCookie(res.headers.get('set-cookie'))
      if (newCookie) return newCookie
    }
  } catch {}
  return cookie
}

async function getProfile(cookie) {
  const res = await fetch('http://localhost:3000/api/user/profile', {
    headers: { Cookie: `fresh_mart_session=${cookie}` },
  })
  return { status: res.status, data: await res.json() }
}

async function adminPatchEmployee(cookie, id, body) {
  const res = await fetch(`http://localhost:3000/api/admin/employees/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `fresh_mart_session=${cookie}`,
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

// ─── Login & save state ───
let { cookie, body: loginBody } = await login(OWNER_EMAIL, OWNER_PASSWORD)
if (!cookie) {
  console.log(`❌ Cannot login as ${OWNER_EMAIL}`)
  console.log(`   Set OWNER_EMAIL and OWNER_PASSWORD env vars to match the current owner.`)
  process.exit(1)
}

const ownerId = loginBody.user.id
cookie = await refreshCookie(cookie)
const originalProfile = await getProfile(cookie)
const originalEmail = originalProfile.data?.user?.email
const originalName = originalProfile.data?.user?.name
const originalRole = originalProfile.data?.user?.role

console.log(`\n=== Admin-Side Email Change Regression Test ===`)
console.log(`Logged in as: ${originalEmail} (id: ${ownerId})`)
console.log(`Original email (will be restored at end): ${originalEmail}`)

const TEST_EMAIL = `test-admin-${Date.now()}@freshmart-test.co.uk`
console.log(`Test email: ${TEST_EMAIL}`)

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

try {
  // Step 1: Change email via /api/admin/employees/[id]
  console.log(`\n--- Step 1: PATCH /api/admin/employees/${ownerId} with new email ---`)
  cookie = await refreshCookie(cookie)
  const result = await adminPatchEmployee(cookie, ownerId, { email: TEST_EMAIL })
  assert('PATCH returns 200', result.status === 200, `got ${result.status} ${JSON.stringify(result.data)}`)
  assert('Response body confirms email change', result.data?.user?.email === TEST_EMAIL, `got ${result.data?.user?.email}`)

  // Step 2: Verify profile endpoint reflects the change
  console.log(`\n--- Step 2: /api/user/profile reflects the new email ---`)
  cookie = await refreshCookie(cookie)
  const profile = await getProfile(cookie)
  assert(
    `Profile email is ${TEST_EMAIL}`,
    profile.data?.user?.email === TEST_EMAIL,
    `got ${profile.data?.user?.email}`
  )

  // Step 3: ⭐ CRITICAL — password must be unchanged
  console.log(`\n--- Step 3: ⭐ CRITICAL — password UNCHANGED after email change ---`)
  console.log(`  Logging in with ${TEST_EMAIL} / ${OWNER_PASSWORD}...`)
  const newLogin = await login(TEST_EMAIL, OWNER_PASSWORD)
  assert(
    `Login with new email + OLD password succeeds`,
    !!newLogin?.cookie,
    `login failed — password may have been corrupted!`
  )
  if (newLogin?.cookie) cookie = newLogin.cookie

  // Step 4: Other fields preserved
  console.log(`\n--- Step 4: Other fields (name, role) preserved ---`)
  cookie = await refreshCookie(cookie)
  const afterProfile = await getProfile(cookie)
  assert(`Name preserved (${originalName})`, afterProfile.data?.user?.name === originalName, `got ${afterProfile.data?.user?.name}`)
  assert(`Role preserved (${originalRole})`, afterProfile.data?.user?.role === originalRole, `got ${afterProfile.data?.user?.role}`)

  // Step 5: mustResetPassword should NOT be flipped
  console.log(`\n--- Step 5: mustResetPassword NOT flipped by email change ---`)
  assert(
    `mustResetPassword is false (not flipped)`,
    afterProfile.data?.user?.mustResetPassword === false,
    `got ${afterProfile.data?.user?.mustResetPassword}`
  )

  // Step 6: Old email can no longer login
  console.log(`\n--- Step 6: Old email no longer works for login ---`)
  const oldLogin = await login(originalEmail, OWNER_PASSWORD)
  assert(
    `Login with OLD email (${originalEmail}) fails`,
    !oldLogin?.cookie,
    'login succeeded — should have failed (old email should be gone)'
  )

  // Step 7: Email uniqueness enforced on admin route
  console.log(`\n--- Step 7: Email uniqueness enforced on admin route ---`)
  cookie = await refreshCookie(cookie)
  const dupResult = await adminPatchEmployee(cookie, ownerId, { email: 'driver@freshmart.co.uk' })
  assert(
    'Cannot change to an email already in use',
    dupResult.status === 409,
    `got ${dupResult.status}`
  )

  // Step 8: Invalid email format rejected on admin route
  console.log(`\n--- Step 8: Invalid email format rejected on admin route ---`)
  cookie = await refreshCookie(cookie)
  const invalidResult = await adminPatchEmployee(cookie, ownerId, { email: 'not-an-email' })
  assert(
    'Invalid email format returns 400',
    invalidResult.status === 400,
    `got ${invalidResult.status}`
  )
} catch (err) {
  console.error('Test threw an error:', err)
  failed++
} finally {
  // ─── ALWAYS restore the original email ───
  console.log(`\n--- CLEANUP: restore email to ${originalEmail} ---`)
  try {
    cookie = await refreshCookie(cookie)
    const restoreResult = await adminPatchEmployee(cookie, ownerId, { email: originalEmail })
    if (restoreResult.status === 200) {
      console.log(`  ✅ Email restored to ${originalEmail}`)
    } else {
      console.log(`  ❌ Could not restore: ${restoreResult.status} ${JSON.stringify(restoreResult.data)}`)
      console.log(`     ⚠️  MANUAL RESTORE REQUIRED:`)
      console.log(`     Login as ${TEST_EMAIL} / ${OWNER_PASSWORD}`)
      console.log(`     Go to /admin/employees and change email back to ${originalEmail}`)
    }
  } catch (err) {
    console.error('  Restore threw:', err)
  }

  // Final verification
  console.log(`\n--- Final verification: login with original email works ---`)
  const verifyLogin = await login(originalEmail, OWNER_PASSWORD)
  if (verifyLogin?.cookie) {
    console.log(`  ✅ Login with ${originalEmail} / ${OWNER_PASSWORD} works — DB is back to original state`)
  } else {
    console.log(`  ❌ Login with ${originalEmail} FAILED — DB is in a bad state!`)
    failed++
  }
}

console.log(`\n=== Summary ===`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Original email preserved: ${originalEmail}`)
console.log(`\nThis regression test verifies that:`)
console.log(`  1. The admin-side email change route (/api/admin/employees/[id])`)
console.log(`     works correctly.`)
console.log(`  2. The PASSWORD is NOT corrupted when the email is changed.`)
console.log(`  3. Other fields (name, role, mustResetPassword) are preserved.`)
console.log(`  4. The test script RESTORES the original email — it will never`)
console.log(`     silently overwrite the user's real email change again.`)

if (failed > 0) process.exit(1)
