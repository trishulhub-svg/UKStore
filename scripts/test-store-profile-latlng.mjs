// Test what happens when latitude is sent as null (e.g., user cleared the input).
import fs from 'fs';

const cookieFile = '/tmp/cookies.txt';
const cookies = fs.readFileSync(cookieFile, 'utf-8');
const match = cookies.match(/fresh_mart_session\s+([^\s;]+)/);
const sessionCookie = match ? match[1] : '';

async function test(label, body) {
  console.log(`\n=== ${label} ===`);
  const res = await fetch('http://localhost:3000/api/admin/store/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `fresh_mart_session=${sessionCookie}`,
    },
    body: JSON.stringify(body),
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log(`Body: ${(await res.text()).slice(0, 400)}`);
}

// Scenario 1: latitude null (user cleared the input)
await test('latitude: null (cleared input)', {
  name: 'Fresh Mart London',
  latitude: null,
});

// Scenario 2: latitude undefined (field omitted)
await test('latitude: undefined (omitted)', {
  name: 'Fresh Mart London',
});

// Scenario 3: latitude empty string
await test('latitude: "" (empty string)', {
  name: 'Fresh Mart London',
  latitude: '',
});

// Scenario 4: latitude as string number
await test('latitude: "51.4612" (string)', {
  name: 'Fresh Mart London',
  latitude: '51.4612',
});

// Scenario 5: latitude out of range
await test('latitude: 999 (out of range)', {
  name: 'Fresh Mart London',
  latitude: 999,
});
