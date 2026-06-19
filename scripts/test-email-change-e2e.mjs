// End-to-end test for the owner email change feature, with extra coverage
// for the bug fix in Task 8 (Navbar showing stale email after change).
//
// ⚠️ EMAIL SAFETY (Task 9):
// This test NO LONGER hard-codes "admin@freshmart.co.uk" as the restore
// value. Instead, it:
//   1. Logs in with whatever email the owner currently has (set via
//      OWNER_EMAIL and OWNER_PASSWORD env vars).
//   2. Saves the original email BEFORE making any changes.
//   3. Uses a unique temporary test email
//      (test-e2e-<timestamp>@freshmart-test.co.uk).
//   4. Restores the ORIGINAL email at the end (whatever it was).
//   5. If anything fails mid-test, the restoration still runs.
//
// Usage:
//   OWNER_EMAIL=kiranpradhan2057@gmail.com OWNER_PASSWORD=Admin@2026 \
//     node scripts/test-email-change-e2e.mjs

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
  return extractCookie(res.headers.get('set-cookie'))
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

async function getSession(cookie) {
  const res = await fetch('http://localhost:3000/api/auth/session', {
    headers: { Cookie: `fresh_mart_session=${cookie}` },
  })
  return { status: res.status, data: await res.json() }
}

async function getProfile(cookie) {
  const res = await fetch('http://localhost:3000/api/user/profile', {
    headers: { Cookie: `fresh_mart_session=${cookie}` },
  })
  return { status: res.status, data: await res.json() }
}

async function changeEmail(cookie, newEmail) {
  const res = await fetch('http://localhost:3000/api/user/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `fresh_mart_session=${cookie}`,
    },
    body: JSON.stringify({ email: newEmail }),
  })
  return {
    status: res.status,
    data: await res.json(),
    setCookie: res.headers.get('set-cookie'),
  }
}

// ─── Login & save the ORIGINAL email so we can restore it later ───
let cookie = await login(OWNER_EMAIL, OWNER_PASSWORD)
if (!cookie) {
  console.log(`❌ Cannot login as ${OWNER_EMAIL}`)
  console.log(`   Set OWNER_EMAIL and OWNER_PASSWORD env vars to match the current owner.`)
  process.exit(1)
}

cookie = await refreshCookie(cookie)
const originalProfile = await getProfile(cookie)
const originalEmail = originalProfile.data?.user?.email
if (!originalEmail) {
  console.log('❌ Could not read current owner email from /api/user/profile')
  process.exit(1)
}

console.log(`\n=== Owner Email Change E2E Test ===`)
console.log(`Logged in as: ${originalEmail}`)
console.log(`Original email (will be restored at end): ${originalEmail}`)

const TEST_EMAIL = `test-e2e-${Date.now()}@freshmart-test.co.uk`
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
  // Step 1: Pre-change session check
  console.log(`\n--- Step 1: Pre-change session ---`)
  cookie = await refreshCookie(cookie)
  let session = await getSession(cookie)
  assert(
    `Session returns current email (${originalEmail})`,
    session.data?.user?.email === originalEmail,
    `got ${session.data?.user?.email}`
  )

  // Step 2: Change email
  console.log(`\n--- Step 2: Change email to ${TEST_EMAIL} ---`)
  cookie = await refreshCookie(cookie)
  const result = await changeEmail(cookie, TEST_EMAIL)
  assert('PATCH returns 200', result.status === 200, `got ${result.status}`)
  assert('Response contains new email', result.data?.user?.email === TEST_EMAIL)
  assert('Server issues new Set-Cookie', !!result.setCookie, 'no Set-Cookie header')
  if (result.setCookie) {
    cookie = extractCookie(result.setCookie)
  }

  // Step 3: New session check (with new cookie)
  console.log(`\n--- Step 3: New session reflects new email ---`)
  session = await getSession(cookie)
  assert(
    `Session returns new email (${TEST_EMAIL})`,
    session.data?.user?.email === TEST_EMAIL,
    `got ${session.data?.user?.email}`
  )
  assert('Session preserves name', session.data?.user?.name === 'Store Owner')
  assert('Session preserves role (OWNER)', session.data?.user?.role === 'OWNER')

  // Step 4: Profile endpoint reflects new email
  console.log(`\n--- Step 4: Profile endpoint reflects new email ---`)
  const profile = await getProfile(cookie)
  assert(
    `Profile returns new email (${TEST_EMAIL})`,
    profile.data?.user?.email === TEST_EMAIL,
    `got ${profile.data?.user?.email}`
  )

  // Step 5: Old email can no longer login (it's been changed)
  console.log(`\n--- Step 5: Old email no longer works for login ---`)
  const oldLogin = await login(originalEmail, OWNER_PASSWORD)
  assert(
    `Login with OLD email (${originalEmail}) fails`,
    oldLogin === null,
    'login succeeded — should have failed'
  )

  // Step 6: New email works for login
  console.log(`\n--- Step 6: New email works for login ---`)
  const newLogin = await login(TEST_EMAIL, OWNER_PASSWORD)
  assert(
    `Login with NEW email (${TEST_EMAIL}) succeeds`,
    newLogin !== null,
    'login failed — should have succeeded'
  )
  // Use the new login cookie from here on
  if (newLogin) cookie = newLogin

  // Step 7: Email uniqueness — try to change to an email already in use
  console.log(`\n--- Step 7: Email uniqueness enforced ---`)
  cookie = await refreshCookie(cookie)
  const dupResult = await changeEmail(cookie, 'driver@freshmart.co.uk')
  assert(
    'Cannot change to an email already in use',
    dupResult.status === 409,
    `got ${dupResult.status}`
  )

  // Step 8: Invalid email format rejected
  console.log(`\n--- Step 8: Invalid email format rejected ---`)
  cookie = await refreshCookie(cookie)
  const invalidResult = await changeEmail(cookie, 'not-an-email')
  assert(
    'Invalid email format returns 400',
    invalidResult.status === 400,
    `got ${invalidResult.status}`
  )

  // Step 9: Non-owner cannot change email
  console.log(`\n--- Step 9: Non-owner cannot change email ---`)
  const custCookie = await login('customer@freshmart.co.uk', 'Customer@2026')
  if (custCookie) {
    const custResult = await changeEmail(custCookie, 'newcustomer@example.com')
    assert(
      'Customer email change blocked (403)',
      custResult.status === 403,
      `got ${custResult.status}`
    )
    assert(
      'Error message is helpful',
      (custResult.data?.error || '').includes('store owner'),
      `got: ${custResult.data?.error}`
    )
  } else {
    console.log('  ⚠️  Could not login as customer — skipping')
  }
} catch (err) {
  console.error('Test threw an error:', err)
  failed++
} finally {
  // ─── ALWAYS restore the original email ───
  console.log(`\n--- CLEANUP: restore email to ${originalEmail} ---`)
  try {
    cookie = await refreshCookie(cookie)
    const restoreResult = await changeEmail(cookie, originalEmail)
    if (restoreResult.status === 200) {
      console.log(`  ✅ Email restored to ${originalEmail}`)
    } else {
      console.log(`  ❌ Could not restore email: ${restoreResult.status} ${JSON.stringify(restoreResult.data)}`)
      console.log(`     ⚠️  MANUAL RESTORE REQUIRED:`)
      console.log(`     Login as ${TEST_EMAIL} / ${OWNER_PASSWORD} and change email back to ${originalEmail}`)
    }
  } catch (err) {
    console.error('  Restore threw:', err)
  }

  // Final verification
  console.log(`\n--- Final verification: login with original email works ---`)
  const verifyCookie = await login(originalEmail, OWNER_PASSWORD)
  if (verifyCookie) {
    console.log(`  ✅ Login with ${originalEmail} works — DB is back to original state`)
  } else {
    console.log(`  ❌ Login with ${originalEmail} FAILED — DB is in a bad state!`)
    failed++
  }
}

console.log(`\n=== Summary ===`)
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Original email preserved: ${originalEmail}`)
console.log(`\nNote: This test verifies the SERVER side of the email change flow.`)
console.log(`The CLIENT side (Navbar showing stale email) was fixed by:`)
console.log(`  - profile-client.tsx dispatches a global event after email change`)
console.log(`  - navbar.tsx listens for the event and re-fetches the session`)

if (failed > 0) process.exit(1)
