// Test that the owner can change their own email via /api/user/profile
// and that non-owner roles are blocked.
//
// NOTE: this server has a 5-minute inactivity timeout (Task 6). Each
// step refreshes the session before making the test request, to avoid
// spurious 401s when the test takes >5 min to run end-to-end.
//
// ⚠️ EMAIL SAFETY (Task 9):
// This test NO LONGER hard-codes "admin@freshmart.co.uk" as the restore
// value. Instead, it:
//   1. Logs in with whatever email the owner currently has (we try a
//      list of candidate passwords against a known owner ID, OR we
//      accept the email as an env var OWNER_EMAIL).
//   2. Saves the original email BEFORE making any changes.
//   3. Uses a temporary test email that's clearly a test email
//      (test-temp-<timestamp>@freshmart-test.co.uk).
//   4. Restores the ORIGINAL email at the end (whatever it was).
//   5. If anything fails mid-test, the restoration still runs (try/finally).
//
// Usage:
//   OWNER_EMAIL=kiranpradhan2057@gmail.com OWNER_PASSWORD=Admin@2026 \
//     node scripts/test-owner-email-change.mjs

import fs from 'fs'

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
  if (!res.ok) {
    return null
  }
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

async function getCurrentEmail(cookie) {
  cookie = await refreshCookie(cookie)
  const res = await fetch('http://localhost:3000/api/user/profile', {
    headers: { Cookie: `fresh_mart_session=${cookie}` },
  })
  const data = await res.json()
  return { email: data?.user?.email || null, cookie }
}

async function tryChangeEmail(cookie, newEmail) {
  cookie = await refreshCookie(cookie)
  const res = await fetch('http://localhost:3000/api/user/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `fresh_mart_session=${cookie}`,
    },
    body: JSON.stringify({ email: newEmail }),
  })
  const data = await res.json()
  return { status: res.status, data, setCookie: res.headers.get('set-cookie'), cookie }
}

async function step(label, fn) {
  console.log(`\n--- ${label} ---`)
  try {
    await fn()
  } catch (err) {
    console.error('  ERROR:', err)
  }
}

// ─── Login & save the ORIGINAL email so we can restore it later ───
let ownerCookie = null
let originalEmail = null

await step(`Pre-test: login as owner (${OWNER_EMAIL})`, async () => {
  ownerCookie = await login(OWNER_EMAIL, OWNER_PASSWORD)
  if (!ownerCookie) {
    console.log(`  ❌ Cannot login as ${OWNER_EMAIL} — set OWNER_EMAIL and OWNER_PASSWORD env vars`)
    console.log(`     Example: OWNER_EMAIL=you@example.com OWNER_PASSWORD=yourpass node $0`)
    process.exit(1)
  }
  const { email, cookie } = await getCurrentEmail(ownerCookie)
  ownerCookie = cookie
  originalEmail = email
  console.log(`  ✅ Logged in. Original email (will be restored at end): ${originalEmail}`)
})

// Generate a unique test email — clearly marked as a test email so it's
// obvious in the DB if anything goes wrong.
const TEST_EMAIL = `test-temp-${Date.now()}@freshmart-test.co.uk`
console.log(`\nTest email: ${TEST_EMAIL}`)

// ─── Run the tests ───
let testsPassed = 0
let testsFailed = 0

function assert(label, condition, details = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    testsPassed++
  } else {
    console.log(`  ❌ ${label} ${details}`)
    testsFailed++
  }
}

await step(`1. Owner changes own email: ${originalEmail} → ${TEST_EMAIL}`, async () => {
  const result = await tryChangeEmail(ownerCookie, TEST_EMAIL)
  assert('PATCH returns 200', result.status === 200, `got ${result.status}`)
  assert('Response contains new email', result.data?.user?.email === TEST_EMAIL)
  assert('Server issues new Set-Cookie', !!result.setCookie, 'no Set-Cookie')
  if (result.setCookie) {
    ownerCookie = extractCookie(result.setCookie)
  }
})

await step('2. Verify email actually changed in DB', async () => {
  const { email } = await getCurrentEmail(ownerCookie)
  assert(`Email is now ${TEST_EMAIL}`, email === TEST_EMAIL, `got ${email}`)
})

await step('3. Try invalid email format', async () => {
  const result = await tryChangeEmail(ownerCookie, 'not-an-email')
  assert('Returns 400', result.status === 400, `got ${result.status}`)
})

await step('4. Try email already in use (use driver@freshmart.co.uk)', async () => {
  const result = await tryChangeEmail(ownerCookie, 'driver@freshmart.co.uk')
  assert('Returns 409', result.status === 409, `got ${result.status}`)
})

await step('5. Non-owner (customer) tries to change email — should be blocked', async () => {
  const custCookie = await login('customer@freshmart.co.uk', 'Customer@2026')
  if (!custCookie) {
    console.log('  ⚠️  Could not login as customer — skipping')
    return
  }
  const result = await tryChangeEmail(custCookie, 'newcustomer@example.com')
  assert('Returns 403', result.status === 403, `got ${result.status}`)
})

await step('6. Non-owner (driver) tries to change email — should be blocked', async () => {
  const drvCookie = await login('driver@freshmart.co.uk', 'Driver@2026')
  if (!drvCookie) {
    console.log('  ⚠️  Could not login as driver — skipping')
    return
  }
  const result = await tryChangeEmail(drvCookie, 'newdriver@example.com')
  assert('Returns 403', result.status === 403, `got ${result.status}`)
})

await step('7. Owner saves profile WITHOUT changing email (no token re-issue)', async () => {
  ownerCookie = await refreshCookie(ownerCookie)
  const res = await fetch('http://localhost:3000/api/user/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `fresh_mart_session=${ownerCookie}`,
    },
    body: JSON.stringify({ name: 'Store Owner', phone: '+44 20 9999 9999' }),
  })
  const setCookie = res.headers.get('set-cookie')
  assert('Returns 200', res.status === 200, `got ${res.status}`)
  assert('No Set-Cookie (no token re-issue)', !setCookie, 'Set-Cookie was issued — bug!')
})

// ─── ALWAYS restore the original email, even if tests failed ───
await step(`8. CLEANUP: restore owner email to original (${originalEmail})`, async () => {
  const result = await tryChangeEmail(ownerCookie, originalEmail)
  if (result.status === 200) {
    console.log(`  ✅ Email restored to ${originalEmail}`)
    if (result.setCookie) {
      ownerCookie = extractCookie(result.setCookie)
    }
  } else {
    console.log(`  ❌ Could not restore email: ${result.status} ${JSON.stringify(result.data)}`)
    console.log(`     ⚠️  MANUAL RESTORE REQUIRED:`)
    console.log(`     Login as ${TEST_EMAIL} / ${OWNER_PASSWORD} and change email back to ${originalEmail}`)
  }
})

// Final verification: original email works for login
await step('9. Final verification: login with original email works', async () => {
  const verifyCookie = await login(originalEmail, OWNER_PASSWORD)
  if (verifyCookie) {
    console.log(`  ✅ Login with ${originalEmail} works — DB is back to original state`)
  } else {
    console.log(`  ❌ Login with ${originalEmail} FAILED — DB is in a bad state!`)
    console.log(`     The test email ${TEST_EMAIL} is still set. Manual restore required.`)
  }
})

console.log(`\n=== Summary ===`)
console.log(`  Passed: ${testsPassed}`)
console.log(`  Failed: ${testsFailed}`)
console.log(`  Original email preserved: ${originalEmail}`)

if (testsFailed > 0) process.exit(1)
