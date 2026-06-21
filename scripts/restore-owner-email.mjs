// Restore the owner email to kiranpradhan2057@gmail.com
// (which the user had set via /admin/employees, then my test scripts reverted)
//
// The password is UNCHANGED (still Admin@2026) — admin email change never
// touches passwordHash. We just need to put the email back.

async function login(email, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  return res.headers.get('set-cookie')?.match(/fresh_mart_session=([^;]+)/)?.[1] || null
}

async function refreshCookie(cookie) {
  try {
    const res = await fetch('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `fresh_mart_session=${cookie}` },
    })
    if (res.ok) {
      const newCookie = res.headers.get('set-cookie')?.match(/fresh_mart_session=([^;]+)/)?.[1]
      if (newCookie) return newCookie
    }
  } catch {}
  return cookie
}

const OWNER_ID = 'cmqe3jghq0000o1k51vobnun0'
const TARGET_EMAIL = 'kiranpradhan2057@gmail.com'

console.log(`Logging in as current owner (admin@freshmart.co.uk)...`)
let cookie = await login('admin@freshmart.co.uk', 'Admin@2026')
if (!cookie) {
  console.log('❌ Cannot login as admin@freshmart.co.uk')
  process.exit(1)
}
console.log(`  ✅ Logged in`)

cookie = await refreshCookie(cookie)

console.log(`\nCalling PATCH /api/admin/employees/${OWNER_ID} to set email=${TARGET_EMAIL}...`)
const res = await fetch(`http://localhost:3000/api/admin/employees/${OWNER_ID}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Cookie: `fresh_mart_session=${cookie}`,
  },
  body: JSON.stringify({ email: TARGET_EMAIL }),
})
const data = await res.json()
console.log(`  Status: ${res.status}`)
console.log(`  Body:`, data)

console.log(`\nVerifying: login with ${TARGET_EMAIL} / Admin@2026...`)
const verifyRes = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TARGET_EMAIL, password: 'Admin@2026' }),
})
const verifyData = await verifyRes.json()
console.log(`  Status: ${verifyRes.status}`)
if (verifyRes.ok) {
  console.log(`  ✅ Login successful!`)
  console.log(`  User:`, verifyData.user)
} else {
  console.log(`  ❌ Login failed:`, verifyData)
}
