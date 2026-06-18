// Generate a PNG logo for the Fresh Mart UK grocery delivery project.
// Uses the z-ai-web-dev-sdk image generation API.

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/home/z/my-project/download';
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'fresh-mart-logo.png');

// Carefully crafted prompt: modern, fresh, grocery-themed, UK-friendly,
// flat vector logo style suitable for app header / favicon / brand mark.
const PROMPT = [
  'Modern minimal flat vector logo for a UK online grocery delivery brand called "Fresh Mart"',
  'centered composition on a clean transparent-friendly solid white background',
  'a stylised green shopping bag formed from a single continuous leaf shape',
  'a small red apple, a golden loaf of bread, and a milk droplet subtly integrated inside the bag',
  'a soft delivery-speed swoosh curving around the bag suggesting fast same-day delivery',
  'wordmark "Fresh Mart" below the icon in a friendly geometric sans-serif, deep forest green',
  'palette: fresh leaf green (#2E7D32), lime accent (#A4C639), warm red (#E53935), cream background',
  'clean geometric shapes, generous whitespace, rounded corners, no photorealism, no gradients on the icon',
  'looks great as an app icon, website header logo, and favicon',
  'high quality, crisp edges, professional brand identity, vector-style'
].join(', ');

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Initialising ZAI SDK...');
  const zai = await ZAI.create();

  console.log('Generating logo (1024x1024)...');
  const response = await zai.images.generations.create({
    prompt: PROMPT,
    size: '1024x1024'
  });

  if (!response?.data?.[0]?.base64) {
    throw new Error('No image data returned from the API');
  }

  const buffer = Buffer.from(response.data[0].base64, 'base64');
  fs.writeFileSync(OUTPUT_PATH, buffer);

  console.log(`\nLogo saved to: ${OUTPUT_PATH}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(2)} KB`);
}

main().catch((err) => {
  console.error('Logo generation failed:', err);
  process.exit(1);
});
