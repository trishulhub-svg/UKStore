// ============================================================
// Task 17 smoke test — employee feature permissions
//
// Verifies:
//   1. Owner can log in
//   2. Owner can create a new picker with RESTRICTED features including
//      an admin-area feature (`orders`)
//   3. The picker can log in
//   4. The picker can GET /api/admin/orders (because they have `orders`)
//   5. The picker CANNOT GET /api/admin/products (because they don't have `products`)
//   6. The picker can GET /api/picker/orders (anyOf: dashboard OR packing)
//   7. The picker can GET /api/user/permissions and sees their features
//   8. Owner can PATCH the picker's permissions to add `products`
//   9. The picker can now GET /api/admin/products
//
// Run with: node --experimental-vm-modules scripts/test-permissions-task17.mjs
// (or just: node scripts/test-permissions-task17.mjs)
// ============================================================

const BASE = process.env.BASE_URL || 'http://localhost:3000'

// Owner credentials — from prisma/seed.ts
const OWNER_EMAIL = 'kiranpradhan2057@gmail.com'
const OWNER_PASSWORD = 'Admin@2026'

// Test picker credentials — created fresh each run
const PICKER_EMAIL = `picker-test-${Date.now()}@freshmart.local`
const PICKER_PASSWORD = 'TempPass123!'

let ownerCookies = ''
let pickerCookies = ''
let pickerId = ''

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return ''
  if (Array.isArray(setCookieHeader)) {
    return setCookieHeader.map((c) => c.split(';')[0]).join('; ')
  }
  return setCookieHeader.split(';')[0]
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`)
  }
  // Extract Set-Cookie headers
  const cookies = parseCookies(res.headers.get('set-cookie'))
  return cookies
}

async function apiCall(method, path, cookies, body) {
  const headers = {
    Cookie: cookies,
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

async function getJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text }
  }
}

let pass = 0
let fail = 0
function check(name, condition, details = '') {
  if (condition) {
    console.log(`  ✓ ${name}`)
    pass++
  } else {
    console.log(`  ✗ ${name} ${details ? '— ' + details : ''}`)
    fail++
  }
}

async function main() {
  console.log(`\n=== Task 17 Permission Smoke Test ===\n`)
  console.log(`Base URL: ${BASE}\n`)

  // ─── Step 1: Owner login ─────────────────────────────────
  console.log('Step 1: Owner login')
  ownerCookies = await login(OWNER_EMAIL, OWNER_PASSWORD)
  check('Owner can log in', !!ownerCookies)

  // ─── Step 2: Create a new picker with restricted features ──
  console.log('\nStep 2: Create new picker with restricted features (orders + picker_dashboard + picker_packing)')
  const createRes = await apiCall('POST', '/api/admin/employees', ownerCookies, {
    name: 'Test Picker Task17',
    email: PICKER_EMAIL,
    role: 'PICKER',
    features: ['orders', 'picker_dashboard', 'picker_packing'], // Restricted — has `orders` (admin) + picker features
  })
  check('Create returns 201', createRes.status === 201, `got ${createRes.status}`)
  const createData = await getJson(createRes)
  check('Create returns employee id', !!createData.employee?.id)
  pickerId = createData.employee?.id
  check('Create returns temp password', !!createData.tempPassword)
  const actualPickerPassword = createData.tempPassword || PICKER_PASSWORD
  console.log(`    Picker ID: ${pickerId}`)
  console.log(`    Picker email: ${PICKER_EMAIL}`)
  console.log(`    Temp password: ${actualPickerPassword}`)

  // ─── Step 3: Picker login ─────────────────────────────────
  console.log('\nStep 3: Picker logs in with temp password')
  // Note: the picker will be asked to reset password on first login, but
  // they should still get a session cookie.
  pickerCookies = await login(PICKER_EMAIL, actualPickerPassword)
  check('Picker can log in with temp password', !!pickerCookies)

  // ─── Step 4: Verify picker's permissions via /api/user/permissions ──
  console.log('\nStep 4: Verify picker permissions via /api/user/permissions')
  const permRes = await apiCall('GET', '/api/user/permissions', pickerCookies)
  check('GET /api/user/permissions returns 200', permRes.status === 200, `got ${permRes.status}`)
  const permData = await getJson(permRes)
  check(
    'Picker has features array with orders',
    Array.isArray(permData.features) && permData.features.includes('orders'),
    `features: ${JSON.stringify(permData.features)}`
  )
  check(
    'Picker has features array with picker_dashboard',
    Array.isArray(permData.features) && permData.features.includes('picker_dashboard'),
    `features: ${JSON.stringify(permData.features)}`
  )
  check(
    'Catalog includes ALL features (not filtered by role)',
    Array.isArray(permData.catalog) && permData.catalog.length >= 20,
    `catalog length: ${permData.catalog?.length}`
  )
  check(
    'Catalog includes admin_dashboard (an admin feature for a PICKER)',
    Array.isArray(permData.catalog) && permData.catalog.some((f) => f.key === 'admin_dashboard'),
    ''
  )

  // ─── Step 5: Picker CAN access /api/admin/orders (has `orders`) ──
  console.log('\nStep 5: Picker accesses /api/admin/orders (should succeed — has orders feature)')
  const ordersRes = await apiCall('GET', '/api/admin/orders', pickerCookies)
  check(
    'GET /api/admin/orders returns 200 (not 403)',
    ordersRes.status === 200,
    `got ${ordersRes.status}`
  )

  // ─── Step 6: Picker CANNOT access /api/admin/products (no `products`) ──
  console.log('\nStep 6: Picker accesses /api/admin/products (should fail — no products feature)')
  const productsRes = await apiCall('GET', '/api/admin/products', pickerCookies)
  check(
    'GET /api/admin/products returns 403 (FEATURE_NOT_ENABLED)',
    productsRes.status === 403,
    `got ${productsRes.status}`
  )
  const productsData = await getJson(productsRes)
  check(
    'Error code is FEATURE_NOT_ENABLED',
    productsData.code === 'FEATURE_NOT_ENABLED',
    `code: ${productsData.code}`
  )

  // ─── Step 7: Picker can access /api/picker/orders (anyOf dashboard OR packing) ──
  console.log('\nStep 7: Picker accesses /api/picker/orders (anyOf: dashboard OR packing)')
  const pickerOrdersRes = await apiCall('GET', '/api/picker/orders', pickerCookies)
  check(
    'GET /api/picker/orders returns 200',
    pickerOrdersRes.status === 200,
    `got ${pickerOrdersRes.status}`
  )

  // ─── Step 8: Owner updates picker's permissions to add `products` ──
  console.log('\nStep 8: Owner adds `products` to picker permissions via PUT /api/admin/employees/[id]/permissions')
  const updatePermRes = await apiCall(
    'PUT',
    `/api/admin/employees/${pickerId}/permissions`,
    ownerCookies,
    { features: ['orders', 'products', 'picker_dashboard', 'picker_packing'] }
  )
  check(
    'PUT permissions returns 200',
    updatePermRes.status === 200,
    `got ${updatePermRes.status}`
  )

  // ─── Step 9: Picker can now access /api/admin/products ──
  console.log('\nStep 9: Picker can now access /api/admin/products after permission update')
  // Note: feature permissions are cached per request, so the next call should see the update.
  const productsRes2 = await apiCall('GET', '/api/admin/products', pickerCookies)
  check(
    'GET /api/admin/products now returns 200',
    productsRes2.status === 200,
    `got ${productsRes2.status}`
  )

  // ─── Step 10: Owner can change picker to full access (null) ──
  console.log('\nStep 10: Owner sets picker to full access (null)')
  const fullAccessRes = await apiCall(
    'PUT',
    `/api/admin/employees/${pickerId}/permissions`,
    ownerCookies,
    { features: null }
  )
  check(
    'PUT null permissions returns 200',
    fullAccessRes.status === 200,
    `got ${fullAccessRes.status}`
  )
  // Verify picker now has full access
  const permRes2 = await apiCall('GET', '/api/user/permissions', pickerCookies)
  const permData2 = await getJson(permRes2)
  check(
    'Picker features is now null (full access)',
    permData2.features === null,
    `features: ${JSON.stringify(permData2.features)}`
  )

  // ─── Step 11: Cleanup — delete the test picker ──
  console.log('\nStep 11: Cleanup')
  // We don't have a DELETE endpoint, so just leave the test picker.
  // It's harmless — marked inactive by name pattern.
  console.log(`    Test picker left in DB: ${PICKER_EMAIL} (id: ${pickerId})`)

  // ─── Summary ─────────────────────────────────────────────
  console.log(`\n=== Summary ===`)
  console.log(`  Passed: ${pass}`)
  console.log(`  Failed: ${fail}`)
  if (fail > 0) {
    console.log('\n  ⚠️  Some checks failed — review output above.')
    process.exit(1)
  } else {
    console.log('\n  ✅ All checks passed!')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err)
  process.exit(2)
})
