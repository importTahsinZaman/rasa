/**
 * Simple script to generate placeholder PNG icons for the extension.
 * Run with: node scripts/generate-icons.js
 *
 * For production, replace these with properly designed icons.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = join(__dirname, '..', 'public', 'icon');

// Ensure icon directory exists
if (!existsSync(iconDir)) {
  mkdirSync(iconDir, { recursive: true });
}

// Create simple colored PNG icons (1x1 pixel scaled)
// These are minimal valid PNGs with a purple color
const sizes = [16, 32, 48, 128];

// PNG header + IHDR + IDAT + IEND for a 1x1 purple pixel
// This is a minimal valid PNG that will be displayed as a solid color
function createMinimalPNG(size) {
  // For simplicity, we'll create a very small BMP-like structure
  // In production, use proper image generation tools

  // Create a simple PNG with a single color
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // For a proper PNG, we need:
  // 1. IHDR chunk (image header)
  // 2. IDAT chunk (image data)
  // 3. IEND chunk (image end)

  // This creates a minimal working PNG
  // Width and height in big-endian
  const width = size;
  const height = size;

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);   // Width
  ihdrData.writeUInt32BE(height, 4);  // Height
  ihdrData.writeUInt8(8, 8);          // Bit depth
  ihdrData.writeUInt8(2, 9);          // Color type (RGB)
  ihdrData.writeUInt8(0, 10);         // Compression method
  ihdrData.writeUInt8(0, 11);         // Filter method
  ihdrData.writeUInt8(0, 12);         // Interlace method

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),       // Length
    Buffer.from('IHDR'),              // Type
    ihdrData,                         // Data
    ihdrCrc                           // CRC
  ]);

  // Create raw image data (RGB, purple color #a855f7)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // Filter byte (none)
    for (let x = 0; x < width; x++) {
      rawData.push(168, 85, 247); // R, G, B (purple)
    }
  }

  // Compress with zlib (deflate)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(compressed.length, 0);
  const idat = Buffer.concat([
    idatLen,
    Buffer.from('IDAT'),
    compressed,
    idatCrc
  ]);

  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iend = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),        // Length
    Buffer.from('IEND'),              // Type
    iendCrc                           // CRC
  ]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 calculation for PNG chunks
function crc32(data) {
  let crc = 0xffffffff;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  const result = Buffer.alloc(4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return result;
}

// Generate icons
for (const size of sizes) {
  try {
    const png = createMinimalPNG(size);
    const filePath = join(iconDir, `${size}.png`);
    writeFileSync(filePath, png);
    console.log(`Created ${filePath}`);
  } catch (error) {
    console.error(`Failed to create ${size}x${size} icon:`, error.message);
  }
}

console.log('\nIcon generation complete!');
console.log('For production, replace these with properly designed icons.');
