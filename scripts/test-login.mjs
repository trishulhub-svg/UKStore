// All-in-one script: start dev server, wait for ready, test login, kill server.
// This avoids the issue of the dev server dying between bash command invocations.

import { spawn, execSync } from 'child_process'
import fs from 'fs'
import http from 'http'

const PROJECT = '/home/z/my-project'
const LOG_FILE = `${PROJECT}/dev.log`

// Kill any existing dev server
try {
  execSync('pkill -f "next dev" || true', { stdio: 'ignore' })
  execSync('pkill -f "npm run dev" || true', { stdio: 'ignore' })
} catch {}
await new Promise(r => setTimeout(r, 2000))

// Start dev server
console.log('Starting dev server...')
fs.writeFileSync(LOG_FILE, '')
const child = spawn('npm', ['run', 'dev'], {
  cwd: PROJECT,
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false,
  shell: false,
})

child.stdout.on('data', d => fs.appendFileSync(LOG_FILE, d))
child.stderr.on('data', d => fs.appendFileSync(LOG_FILE, d))

// Wait for "Ready in" message
const ready = await new Promise((resolve) => {
  const start = Date.now()
  const timer = setInterval(() => {
    const log = fs.readFileSync(LOG_FILE, 'utf-8')
    if (log.includes('Ready in')) {
      clearInterval(timer)
      console.log(`Dev server ready after ${Date.now() - start}ms`)
      resolve(true)
    } else if (Date.now() - start > 30000) {
      clearInterval(timer)
      console.log('Dev server failed to start within 30s')
      resolve(false)
    }
  }, 500)
})

if (!ready) {
  console.log('Dev log:')
  console.log(fs.readFileSync(LOG_FILE, 'utf-8'))
  child.kill('SIGTERM')
  process.exit(1)
}

// Wait a bit more for Prisma to initialize
await new Promise(r => setTimeout(r, 3000))

// Helper: HTTP request
function httpRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Test Client',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
      timeout: 30000,
    }, (res) => {
      let chunks = ''
      res.on('data', c => chunks += c)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: chunks }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(new Error('timeout')); reject(new Error('timeout')) })
    if (data) req.write(data)
    req.end()
  })
}

// Test 1: Wrong email
console.log('\n=== Test 1: Wrong email (should fail) ===')
let r = await httpRequest('POST', '/api/auth/login', {
  email: 'nonexistent@example.com',
  password: 'wrong',
})
console.log(`Status: ${r.status}`)
console.log(`Body: ${r.body.substring(0, 200)}`)

// Test 2: Correct email/password
console.log('\n=== Test 2: Correct credentials (kiranpradhan2057@gmail.com / Admin@2026) ===')
r = await httpRequest('POST', '/api/auth/login', {
  email: 'kiranpradhan2057@gmail.com',
  password: 'Admin@2026',
})
console.log(`Status: ${r.status}`)
console.log(`Body: ${r.body.substring(0, 500)}`)

const setCookie = r.headers['set-cookie']
let sessionCookie = null
if (setCookie) {
  for (const c of setCookie) {
    const m = c.match(/^(fresh_mart_session=[^;]+)/)
    if (m) {
      sessionCookie = m[1]
      break
    }
  }
}
console.log(`Session cookie captured: ${sessionCookie ? 'YES' : 'NO'}`)

// Test 3: Verify session works (GET /api/auth/session)
if (sessionCookie) {
  console.log('\n=== Test 3: Verify session is valid ===')
  r = await httpRequest('GET', '/api/auth/session', null, {
    Cookie: sessionCookie,
  })
  console.log(`Status: ${r.status}`)
  console.log(`Body: ${r.body.substring(0, 500)}`)
}

// Test 4: Try to login AGAIN with same account (should replace the old session for OWNER)
if (sessionCookie) {
  console.log('\n=== Test 4: Second login (should replace first session for OWNER) ===')
  r = await httpRequest('POST', '/api/auth/login', {
    email: 'kiranpradhan2057@gmail.com',
    password: 'Admin@2026',
  })
  console.log(`Status: ${r.status}`)
  console.log(`Body: ${r.body.substring(0, 500)}`)
}

// Test 5: Verify OLD session is now invalid (since OWNER can only have 1 device)
if (sessionCookie) {
  console.log('\n=== Test 5: Old session should now be invalid ===')
  r = await httpRequest('GET', '/api/auth/session', null, {
    Cookie: sessionCookie,
  })
  console.log(`Status: ${r.status}`)
  console.log(`Body: ${r.body.substring(0, 200)}`)
}

// Kill dev server
console.log('\n=== Done — killing dev server ===')
child.kill('SIGTERM')
await new Promise(r => setTimeout(r, 1000))
try { child.kill('SIGKILL') } catch {}
process.exit(0)
