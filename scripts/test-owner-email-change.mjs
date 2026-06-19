// Test that the owner can change their own email via /api/user/profile
// and that non-owner roles are blocked.
//
// NOTE: this server has a 5-minute inactivity timeout (Task 6). Each
// step refreshes the session before making the test request, to avoid
// spurious 401s when the test takes >5 min to run end-to-end.

import fs from 'fs'

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
    console.log(`  Login failed for ${email}: ${res.status} ${await res.text()}`)
    return null
  }
  return extractCookie(res.headers.get('set-cookie'))
}

// Refresh the session token — needed because the server enforces a 5-min
// inactivity timeout. Returns the refreshed cookie (or the original if
// refresh failed).
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

// The owner account starts as admin@freshmart.co.uk
// (Restore it if a previous test left it as newowner@freshmart.co.uk)
await step('Pre-test: login as owner (try admin@ first, fall back to newowner@)', async () => {
  let cookie = await login('admin@freshmart.co.uk', 'Admin@2026')
  if (!cookie) {
    console.log('  admin@ failed, trying newowner@...')
    cookie = await login('newowner@freshmart.co.uk', 'Admin@2026')
  }
  if (!cookie) {
    console.log('  Both failed — cannot proceed with test')
    process.exit(1)
  }
  fs.writeFileSync('/tmp/owner-cookie.txt', cookie)
  const { email } = await getCurrentEmail(cookie)
  console.log(`  Logged in. Current email: ${email}`)
})

let ownerCookie = fs.readFileSync('/tmp/owner-cookie.txt', 'utf-8')
const { email: currentEmail, cookie: refreshedOwnerCookie } = await getCurrentEmail(ownerCookie)
ownerCookie = refreshedOwnerCookie
fs.writeFileSync('/tmp/owner-cookie.txt', ownerCookie)

const testEmail = currentEmail === 'admin@freshmart.co.uk' ? 'newowner@freshmart.co.uk' : 'admin@freshmart.co.uk'

await step(`1. Owner changes own email: ${currentEmail} → ${testEmail}`, async () => {
  const result = await tryChangeEmail(ownerCookie, testEmail)
  console.log(`  Status: ${result.status} (expected 200)`)
  console.log(`  Body: ${JSON.stringify(result.data).slice(0, 200)}`)
  console.log(`  New Set-Cookie issued: ${result.setCookie ? 'YES (session re-issued)' : 'NO'}`)
  if (result.setCookie) {
    const newCookie = extractCookie(result.setCookie)
    fs.writeFileSync('/tmp/owner-cookie.txt', newCookie)
    ownerCookie = newCookie
    console.log(`  Cookie updated in test file`)
  }
})

await step('2. Verify email actually changed in DB', async () => {
  const { email, cookie } = await getCurrentEmail(ownerCookie)
  ownerCookie = cookie
  fs.writeFileSync('/tmp/owner-cookie.txt', ownerCookie)
  console.log(`  Current email now: ${email} (expected: ${testEmail})`)
  if (email === testEmail) {
    console.log('  ✅ Email change successful and new session token works')
  } else {
    console.log('  ❌ Email not updated or new token not working')
  }
})

await step('3. Try invalid email format', async () => {
  const result = await tryChangeEmail(ownerCookie, 'not-an-email')
  console.log(`  Status: ${result.status} (expected 400)`)
  console.log(`  Body: ${JSON.stringify(result.data)}`)
})

await step('4. Try email already in use (use driver@freshmart.co.uk)', async () => {
  const result = await tryChangeEmail(ownerCookie, 'driver@freshmart.co.uk')
  console.log(`  Status: ${result.status} (expected 409)`)
  console.log(`  Body: ${JSON.stringify(result.data)}`)
})

await step('5. Non-owner (customer) tries to change email — should be blocked', async () => {
  const custCookie = await login('customer@freshmart.co.uk', 'Customer@2026')
  if (!custCookie) {
    console.log('  Could not login as customer — skipping')
    return
  }
  const result = await tryChangeEmail(custCookie, 'newcustomer@example.com')
  console.log(`  Status: ${result.status} (expected 403)`)
  console.log(`  Body: ${JSON.stringify(result.data)}`)
})

await step('6. Non-owner (driver) tries to change email — should be blocked', async () => {
  const drvCookie = await login('driver@freshmart.co.uk', 'Driver@2026')
  if (!drvCookie) {
    console.log('  Could not login as driver — skipping')
    return
  }
  const result = await tryChangeEmail(drvCookie, 'newdriver@example.com')
  console.log(`  Status: ${result.status} (expected 403)`)
  console.log(`  Body: ${JSON.stringify(result.data)}`)
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
  console.log(`  Status: ${res.status} (expected 200)`)
  console.log(`  Set-Cookie issued: ${setCookie ? 'YES (would be a bug — no email change)' : 'NO (correct — no token re-issue needed)'}`)
})

await step('8. Restore owner email to admin@freshmart.co.uk for cleanliness', async () => {
  const { email } = await getCurrentEmail(ownerCookie)
  if (email !== 'admin@freshmart.co.uk') {
    console.log(`  Current email is ${email}, restoring to admin@freshmart.co.uk`)
    const result = await tryChangeEmail(ownerCookie, 'admin@freshmart.co.uk')
    console.log(`  Status: ${result.status}`)
    if (result.setCookie) {
      fs.writeFileSync('/tmp/owner-cookie.txt', extractCookie(result.setCookie))
    }
  } else {
    console.log(`  Already admin@freshmart.co.uk — no restore needed`)
  }
})

console.log('\n=== All tests done ===')

