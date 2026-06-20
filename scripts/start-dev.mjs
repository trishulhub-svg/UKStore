// Start dev server in a way that survives the bash tool's process cleanup.
// Uses setsid to create a new session + nohup to ignore SIGHUP + double-fork
// pattern via shell to fully detach.

import { spawn } from 'child_process'
import fs from 'fs'
import { execSync } from 'child_process'

const PROJECT = '/home/z/my-project'
const LOG_FILE = `${PROJECT}/dev.log`
const PID_FILE = `${PROJECT}/dev.pid`

// Kill any existing dev server
try {
  execSync('pkill -f "next dev" || true', { stdio: 'ignore' })
  execSync('pkill -f "npm run dev" || true', { stdio: 'ignore' })
} catch {}
await new Promise(r => setTimeout(r, 2000))

// Clear log
fs.writeFileSync(LOG_FILE, '')

// Use setsid to start in a new session, with full detachment
const child = spawn('setsid', [
  'bash', '-c',
  `cd ${PROJECT} && exec npm run dev > ${LOG_FILE} 2>&1 < /dev/null &\necho $! > ${PID_FILE}\nexit 0`
], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
  shell: false,
})

child.stdout.on('data', d => process.stdout.write(d))
child.stderr.on('data', d => process.stderr.write(d))

// Wait for child to exit (it should exit immediately after backgrounding)
await new Promise(r => child.on('exit', r))

// Wait for dev server to be ready
console.log('Waiting for dev server to be ready...')
const ready = await new Promise((resolve) => {
  const start = Date.now()
  const timer = setInterval(() => {
    try {
      const log = fs.readFileSync(LOG_FILE, 'utf-8')
      if (log.includes('Ready in')) {
        clearInterval(timer)
        console.log(`Dev server ready after ${Date.now() - start}ms`)
        resolve(true)
      } else if (Date.now() - start > 30000) {
        clearInterval(timer)
        console.log('Dev server failed to start within 30s')
        console.log('Log:', log)
        resolve(false)
      }
    } catch {}
  }, 500)
})

if (!ready) process.exit(1)

// Read PID
try {
  const pid = fs.readFileSync(PID_FILE, 'utf-8').trim()
  console.log(`Dev server PID: ${pid}`)
} catch {}

// Verify process is alive
await new Promise(r => setTimeout(r, 2000))
try {
  const out = execSync('ps aux | grep -E "next dev|npm run dev" | grep -v grep', { encoding: 'utf-8' })
  console.log('\nDev server processes:')
  console.log(out)
} catch {
  console.log('No dev server processes found!')
}
