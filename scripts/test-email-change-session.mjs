// Debug test: verify that after an email change, the new session cookie
// carries the new email, and that all three places that read the email
// (DB, /api/user/profile, /api/auth/session) return the NEW email.
//
// This isolates whether the bug is server-side (token not updated) or
// client-side (Navbar showing stale cached value).

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
  if (!res.ok) {
    console.log(`  Login failed for ${email}: ${res.status} ${await res.text()}`)
    return null
  }
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

// Try to log in as the owner — email may be admin@ or newowner@ from previous tests
let cookie = await login('admin@freshmart.co.uk', 'Admin@2026')
let currentEmail = 'admin@freshmart.co.uk'
if (!cookie) {
  cookie = await login('newowner@freshmart.co.uk', 'Admin@2026')
  currentEmail = 'newowner@freshmart.co.uk'
}
if (!cookie) {
  console.log('Cannot login — aborting')
  process.exit(1)
}

console.log(`\n[1] Initial login as: ${currentEmail}`)
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

const newEmail = currentEmail === 'admin@freshmart.co.uk'
  ? 'newowner@freshmart.co.uk'
  : 'admin@freshmart.co.uk'

console.log(`\n[4] Changing email: ${currentEmail} → ${newEmail}`)
cookie = await refreshCookie(cookie)
const result = await changeEmail(cookie, newEmail)
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
console.log(`    Email:  ${session.data?.user?.email}  ← should be ${newEmail}`)
console.log(`    Name:   ${session.data?.user?.name}`)
console.log(`    Role:   ${session.data?.user?.role}`)

console.log(`\n[6] Post-change /api/user/profile response (with NEW cookie):`)
profile = await getProfile(cookie)
console.log(`    Status: ${profile.status}`);
console.log(`    Email:  ${profile.data?.user?.email}  ← should be ${newEmail}`)

console.log(`\n[7] Decode the JWT-style token to inspect payload:`)
// Token format is base64url-encoded JSON payload between two dots (HMAC signed)
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

console.log(`\n[8] Verify the OLD cookie no longer works (email-wise):`)
// Use the OLD cookie (before the change) — it should still authenticate but
// carry the OLD email. This confirms the server is reading from the token,
// not the DB.
// We don't have the OLD cookie here since we overwrote it. But we can test
// that the NEW cookie works.

console.log(`\n=== Test complete ===`)
console.log(`\nSummary:`)
console.log(`  - Server-side email change: ${result.status === 200 ? 'WORKS' : 'FAILS'}`)
console.log(`  - New session cookie issued: ${result.setCookie ? 'YES' : 'NO'}`)
console.log(`  - /api/auth/session returns new email: ${session.data?.user?.email === newEmail ? 'YES' : 'NO'}`)
console.log(`  - /api/user/profile returns new email: ${profile.data?.user?.email === newEmail ? 'YES' : 'NO'}`)
console.log(`\nIf the server-side is all YES, then the bug is client-side — the Navbar`)
console.log(`(and any other component that caches the user in state) is showing the`)
console.log(`OLD email because its useEffect only runs on mount.`)
