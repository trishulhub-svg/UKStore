// Debug test: verify that after an email change, the new session cookie
// carries the new email, and that all three places that read the email
// (DB, /api/user/profile, /api/auth/session) return the NEW email.
//
// This isolates whether the bug is server-side (token not updated) or
// client-side (Navbar showing stale cached value).
//
// ⚠️ EMAIL SAFETY (Task 9):
// This test does NOT hard-code "admin@freshmart.co.uk" as the restore
// value. It saves the original email and restores it at the end.
//
// Usage:
//   OWNER_EMAIL=kiranpradhan2057@gmail.com OWNER_PASSWORD=Admin@2026 \
//     node scripts/test-email-change-session.mjs

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'admin@freshmart.co.uk'
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Admin@2026'

function extractCookie(setCookie) {
  if (!setCookie) return ''
  const match = setCookie.match(/fresh_mart_session=([^;]+)/)
  return match ? match[1] : ''
}

async function refreshCookie(cookie) {
  const res = await fetch('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: { Cookie: `fresh_mart_session=${cookie}` },
  })
  if (res.ok) {
    const newCookie = extractCookie(res.headers.get('set-cookie'))
    if (newCookie) return newCookie
  }
  return cookie
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

let cookie = await login(OWNER_EMAIL, OWNER_PASSWORD)
if (!cookie) {
  console.log(`❌ Cannot login as ${OWNER_EMAIL}`)
  process.exit(1)
}

cookie = await refreshCookie(cookie)
const originalProfile = await getProfile(cookie)
const originalEmail = originalProfile.data?.user?.email

console.log(`\n[1] Initial login as: ${originalEmail}`)
console.log(`    Cookie length: ${cookie.length}`)

console.log(`\n[2] Pre-change /api/auth/session response:`)
let session = await getSession(cookie)
console.log(`    Status: ${session.status}`)
console.log(`    Email:  ${session.data?.user?.email}`)
console.log(`    Name:   ${session.data?.user?.name}`)
console.log(`    Role:   ${session.data?.user?.role}`)

console.log(`\n[3] Pre-change /api/user/profile response:`)
let profile = await getProfile(cookie)
console.log(`    Status: ${profile.status}`);
console.log(`    Email:  ${profile.data?.user?.email}`)

const TEST_EMAIL = `test-debug-${Date.now()}@freshmart-test.co.uk`

console.log(`\n[4] Changing email: ${originalEmail} → ${TEST_EMAIL}`)
cookie = await refreshCookie(cookie)
const result = await changeEmail(cookie, TEST_EMAIL)
console.log(`    PATCH status: ${result.status}`)
console.log(`    PATCH body.email: ${result.data?.user?.email}`)
console.log(`    New Set-Cookie issued: ${result.setCookie ? 'YES' : 'NO'}`)
if (result.setCookie) {
  cookie = extractCookie(result.setCookie)
  console.log(`    Cookie updated (length: ${cookie.length})`)
}

console.log(`\n[5] Post-change /api/auth/session response (with NEW cookie):`)
session = await getSession(cookie)
console.log(`    Status: ${session.status}`)
console.log(`    Email:  ${session.data?.user?.email}  ← should be ${TEST_EMAIL}`)
console.log(`    Name:   ${session.data?.user?.name}`)
console.log(`    Role:   ${session.data?.user?.role}`)

console.log(`\n[6] Post-change /api/user/profile response (with NEW cookie):`)
profile = await getProfile(cookie)
console.log(`    Status: ${profile.status}`);
console.log(`    Email:  ${profile.data?.user?.email}  ← should be ${TEST_EMAIL}`)

console.log(`\n[7] Decode the JWT-style token to inspect payload:`)
const parts = cookie.split('.')
if (parts.length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    console.log(`    Token payload:`, payload)
  } catch (e) {
    console.log(`    Could not decode payload: ${e.message}`)
  }
} else {
  console.log(`    Token does not have 3 parts — format: ${parts.length} parts`)
}

// ─── CLEANUP: restore the original email ───
console.log(`\n[8] CLEANUP: restoring email to ${originalEmail}`)
cookie = await refreshCookie(cookie)
const restoreResult = await changeEmail(cookie, originalEmail)
if (restoreResult.status === 200) {
  console.log(`    ✅ Email restored to ${originalEmail}`)
} else {
  console.log(`    ❌ Could not restore: ${restoreResult.status} ${JSON.stringify(restoreResult.data)}`)
  console.log(`       ⚠️  MANUAL RESTORE REQUIRED: login as ${TEST_EMAIL} / ${OWNER_PASSWORD}`)
  console.log(`       and change email back to ${originalEmail}`)
}

console.log(`\n=== Test complete ===`)
console.log(`\nSummary:`)
console.log(`  - Server-side email change: ${result.status === 200 ? 'WORKS' : 'FAILS'}`)
console.log(`  - New session cookie issued: ${result.setCookie ? 'YES' : 'NO'}`)
console.log(`  - /api/auth/session returns new email: ${session.data?.user?.email === TEST_EMAIL ? 'YES' : 'NO'}`)
console.log(`  - /api/user/profile returns new email: ${profile.data?.user?.email === TEST_EMAIL ? 'YES' : 'NO'}`)
console.log(`  - Original email restored: ${restoreResult.status === 200 ? 'YES' : 'NO'}`)
console.log(`\nIf the server-side is all YES, then the bug is client-side — the Navbar`)
console.log(`(and any other component that caches the user in state) is showing the`)
console.log(`OLD email because its useEffect only runs on mount.`)
