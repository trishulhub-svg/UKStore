// End-to-end test of the 5-minute inactivity timeout.
// Tests:
//   1. Login → get session cookie
//   2. Immediate API call → 200 (token fresh)
//   3. /api/auth/refresh → 200 + new cookie (sliding window)
//   4. Use genuinely-expired token (iat 10 min ago) → API returns 401
//   5. /api/auth/refresh with expired token → 401 (can't refresh an expired session)

import fs from 'fs'
import crypto from 'crypto'

function extractCookie(setCookie) {
  if (!setCookie) return ''
  const match = setCookie.match(/fresh_mart_session=([^;]+)/)
  return match ? match[1] : ''
}

async function step(label, fn) {
  console.log(`\n--- ${label} ---`)
  try {
    await fn()
  } catch (err) {
    console.error('  ERROR:', err)
  }
}

await step('1. Login as admin', async () => {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@freshmart.co.uk', password: 'Admin@2026' }),
  })
  const cookie = extractCookie(res.headers.get('set-cookie'))
  fs.writeFileSync('/tmp/cookies-test.txt', cookie)
  const data = await res.json()
  console.log(`  Status: ${res.status}`)
  console.log(`  User: ${data?.user?.email} (${data?.user?.role})`)
  console.log(`  Cookie saved (len=${cookie.length})`)
})

const cookie = fs.readFileSync('/tmp/cookies-test.txt', 'utf-8')

await step('2. Immediate API call (token fresh)', async () => {
  const res = await fetch('http://localhost:3000/api/admin/store/profile', {
    headers: { Cookie: `fresh_mart_session=${cookie}` },
  })
  console.log(`  Status: ${res.status} (expected 200)`)
  const body = await res.text()
  console.log(`  Body preview: ${body.slice(0, 80)}`)
})

await step('3. /api/auth/session (verify auth check works)', async () => {
  const res = await fetch('http://localhost:3000/api/auth/session', {
    headers: { Cookie: `fresh_mart_session=${cookie}` },
  })
  console.log(`  Status: ${res.status} (expected 200)`)
  const data = await res.json()
  console.log(`  User: ${data?.user?.email}`)
})

await step('4. /api/auth/refresh (sliding window — get new token)', async () => {
  const res = await fetch('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: { Cookie: `fresh_mart_session=${cookie}` },
  })
  console.log(`  Status: ${res.status} (expected 200)`)
  const newCookie = extractCookie(res.headers.get('set-cookie'))
  console.log(`  New cookie issued: ${newCookie ? 'YES' : 'NO'}`)
  console.log(`  Cookies differ: ${newCookie && newCookie !== cookie ? 'YES (good)' : 'NO (bad)'}`)
  if (newCookie) fs.writeFileSync('/tmp/cookies-test.txt', newCookie)
  const data = await res.json()
  console.log(`  User: ${data?.user?.email}`)
})

await step('5. Inspect token payload', async () => {
  const [payloadB64] = cookie.split('.')
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'))
  console.log(`  iat: ${payload.iat} (${new Date(payload.iat * 1000).toISOString()})`)
  console.log(`  ver: ${payload.ver}`)
  console.log(`  Current age: ${Math.floor((Date.now() / 1000) - payload.iat)}s (must be < 300 for valid)`)
})

await step('6. Use genuinely-expired token (iat 10 min ago, correct signature)', async () => {
  const SECRET = 'fresh-mart-local-dev-secret-change-in-production'
  const oldPayload = {
    uid: 'cmqe3jghq0000o1k51vobnun0',
    email: 'admin@freshmart.co.uk',
    role: 'OWNER',
    name: 'Store Owner',
    iat: Math.floor(Date.now() / 1000) - 10 * 60,
    ver: 1,
  }
  const payloadStr = Buffer.from(JSON.stringify(oldPayload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  const expiredToken = `${payloadStr}.${sig}`

  const res = await fetch('http://localhost:3000/api/admin/store/profile', {
    headers: { Cookie: `fresh_mart_session=${expiredToken}` },
  })
  console.log(`  Status: ${res.status} (expected 401 — token expired by >5 min)`)
  const body = await res.text()
  console.log(`  Body: ${body.slice(0, 100)}`)
})

await step('7. Refresh with expired token (should fail)', async () => {
  const SECRET = 'fresh-mart-local-dev-secret-change-in-production'
  const oldPayload = {
    uid: 'cmqe3jghq0000o1k51vobnun0',
    email: 'admin@freshmart.co.uk',
    role: 'OWNER',
    name: 'Store Owner',
    iat: Math.floor(Date.now() / 1000) - 10 * 60,
    ver: 1,
  }
  const payloadStr = Buffer.from(JSON.stringify(oldPayload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  const expiredToken = `${payloadStr}.${sig}`

  const res = await fetch('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: { Cookie: `fresh_mart_session=${expiredToken}` },
  })
  console.log(`  Status: ${res.status} (expected 401 — can't refresh expired session)`)
  const body = await res.text()
  console.log(`  Body: ${body.slice(0, 100)}`)
})

await step('8. Middleware edge check — admin page with expired token', async () => {
  const SECRET = 'fresh-mart-local-dev-secret-change-in-production'
  const oldPayload = {
    uid: 'cmqe3jghq0000o1k51vobnun0',
    email: 'admin@freshmart.co.uk',
    role: 'OWNER',
    name: 'Store Owner',
    iat: Math.floor(Date.now() / 1000) - 10 * 60,
    ver: 1,
  }
  const payloadStr = Buffer.from(JSON.stringify(oldPayload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  const expiredToken = `${payloadStr}.${sig}`

  const res = await fetch('http://localhost:3000/admin', {
    headers: { Cookie: `fresh_mart_session=${expiredToken}` },
    redirect: 'manual',
  })
  console.log(`  Status: ${res.status} (expected 307 redirect to /auth/login)`)
  console.log(`  Location: ${res.headers.get('location')}`)
})

console.log('\n=== All tests done ===')
