// Test the store profile PUT endpoint with a realistic-sized logo.
import fs from 'fs';

const cookieFile = '/tmp/cookies.txt';
const cookies = fs.readFileSync(cookieFile, 'utf-8');
const match = cookies.match(/fresh_mart_session\s+([^\s;]+)/);
const sessionCookie = match ? match[1] : '';

if (!sessionCookie) {
  console.error('Could not extract session cookie from', cookieFile);
  process.exit(1);
}

const logoB64 = fs.readFileSync('/home/z/my-project/download/fresh-mart-logo.png').toString('base64');
const logoUrl = `data:image/png;base64,${logoB64}`;
console.log(`Logo data URL size: ${(logoUrl.length / 1024).toFixed(1)} KB`);

const body = JSON.stringify({
  name: 'Fresh Mart London',
  address: '123 High Street, Lewisham, London, SE13 6LG',
  latitude: 51.4612,
  longitude: -0.0117,
  phone: '+44 20 1234 5678',
  email: 'hello@freshmartlondon.co.uk',
  logoUrl,
});

console.log(`Total request body size: ${(body.length / 1024).toFixed(1)} KB`);

const res = await fetch('http://localhost:3000/api/admin/store/profile', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `fresh_mart_session=${sessionCookie}`,
  },
  body,
});

console.log(`\nResponse status: ${res.status} ${res.statusText}`);
const text = await res.text();
console.log(`Response body (first 400 chars): ${text.slice(0, 400)}`);
