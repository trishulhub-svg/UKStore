// Test what happens with: (1) no cookie, (2) expired/invalid cookie, (3) wrong-role cookie.
import fs from 'fs';

async function test(label, cookieStr) {
  console.log(`\n=== ${label} ===`);
  const res = await fetch('http://localhost:3000/api/admin/store/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
    body: JSON.stringify({ name: 'Fresh Mart Test' }),
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log(`Body: ${(await res.text()).slice(0, 300)}`);
}

// 1. No cookie at all
await test('No cookie (unauthenticated)', '');

// 2. Invalid/garbage cookie
await test('Invalid cookie', 'fresh_mart_session=garbage.token.here');

// 3. Tampered valid-looking cookie (correct format, bad signature)
await test('Tampered cookie', 'fresh_mart_session=eyJ1aWQiOiJ4IiwiaWF0IjoxfQ.invalidsig');

// 4. Customer-role cookie (not owner) — first need to login as customer
console.log('\n=== Login as customer to test role check ===');
const custRes = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'customer@freshmart.co.uk', password: 'Customer@2026' }),
});
const custSetCookie = custRes.headers.get('set-cookie') || '';
const custCookieMatch = custSetCookie.match(/fresh_mart_session=([^;]+)/);
if (custCookieMatch) {
  console.log('Logged in as customer, testing PUT...');
  await test('Customer role cookie', `fresh_mart_session=${custCookieMatch[1]}`);
} else {
  console.log('Could not login as customer:', await custRes.text());
}
