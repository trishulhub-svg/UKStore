#!/usr/bin/env node
// ============================================================
// Turso migration / seed helper.
//
// Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env, builds
// a single DATABASE_URL with the auth token embedded as a query
// string (the format Prisma + libSQL expect), and runs the
// requested prisma command.
//
// Usage:
//   node scripts/turso-setup.mjs push   # prisma db push
//   node scripts/turso-setup.mjs seed   # tsx prisma/seed.ts
//   node scripts/turso-setup.mjs all    # both, in order
// ============================================================

import { config } from 'dotenv'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const TURSO_URL = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!TURSO_URL) {
  console.error('❌ TURSO_DATABASE_URL is not set.')
  console.error('   Add it to .env (see .env.example for instructions).')
  process.exit(1)
}

if (!TURSO_TOKEN) {
  console.error('❌ TURSO_AUTH_TOKEN is not set.')
  console.error('   Add it to .env (see .env.example for instructions).')
  process.exit(1)
}

// Build the combined URL. libSQL accepts ?authToken=... query param.
const sep = TURSO_URL.includes('?') ? '&' : '?'
const combinedUrl = `${TURSO_URL}${sep}authToken=${TURSO_TOKEN}`

// Set env vars for child processes
process.env.DATABASE_URL = combinedUrl

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${label}`)
    console.log(`  $ ${cmd} ${args.join(' ')}\n`)
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: projectRoot,
      env: process.env,
      shell: process.platform === 'win32',
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

const command = process.argv[2] || 'all'

async function main() {
  console.log('══════════════════════════════════════════════════════════')
  console.log('  Turso Setup Helper')
  console.log('══════════════════════════════════════════════════════════')
  console.log(`  Target:  ${TURSO_URL}`)
  console.log(`  Token:   ${TURSO_TOKEN.substring(0, 12)}...`)
  console.log('══════════════════════════════════════════════════════════')

  if (command === 'push' || command === 'all') {
    await run('npx', ['prisma', 'db', 'push', '--skip-generate'], 'Step 1/2: prisma db push')
  }

  if (command === 'seed' || command === 'all') {
    await run('npx', ['tsx', 'prisma/seed.ts'], 'Step 2/2: tsx prisma/seed.ts')
  }

  console.log('\n✅ Done. Turso DB is ready.')
  console.log('   Next step: add TURSO_DATABASE_URL + TURSO_AUTH_TOKEN to Vercel env vars.')
  console.log('   Then redeploy on Vercel.')
}

main().catch((err) => {
  console.error('\n❌ Failed:', err.message)
  process.exit(1)
})
