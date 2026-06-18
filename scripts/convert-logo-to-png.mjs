// Convert the generated logo (returned as JPEG bytes) into a true PNG file.
import sharp from 'sharp';
import fs from 'fs';

const SRC = '/home/z/my-project/download/fresh-mart-logo.png';
const TMP = '/home/z/my-project/download/fresh-mart-logo-tmp.jpg';
const OUT = '/home/z/my-project/download/fresh-mart-logo.png';

// Move current bytes to .jpg
fs.renameSync(SRC, TMP);

await sharp(TMP)
  .png({ compressionLevel: 9 })
  .toFile(OUT);

fs.unlinkSync(TMP);

const stat = fs.statSync(OUT);
console.log(`Converted to PNG: ${OUT}`);
console.log(`File size: ${(stat.size / 1024).toFixed(2)} KB`);
