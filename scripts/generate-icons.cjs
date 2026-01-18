/**
 * Generate placeholder PNG icons for the extension.
 * Run with: node scripts/generate-icons.cjs
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconDir = path.join(__dirname, '..', 'public', 'icon');

// Ensure icon directory exists
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
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

function createPNG(size) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);    // Width
  ihdrData.writeUInt32BE(size, 4);    // Height
  ihdrData.writeUInt8(8, 8);          // Bit depth
  ihdrData.writeUInt8(6, 9);          // Color type (RGBA)
  ihdrData.writeUInt8(0, 10);         // Compression method
  ihdrData.writeUInt8(0, 11);         // Filter method
  ihdrData.writeUInt8(0, 12);         // Interlace method

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const ihdr = Buffer.concat([ihdrLen, Buffer.from('IHDR'), ihdrData, ihdrCrc]);

  // Create raw image data (RGBA, purple gradient)
  const rawData = [];
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2;
  const cornerRadius = size * 0.2;

  for (let y = 0; y < size; y++) {
    rawData.push(0); // Filter byte (none)
    for (let x = 0; x < size; x++) {
      // Create rounded rectangle effect
      let alpha = 255;

      // Check if we're in a corner area
      const corners = [
        { cx: cornerRadius, cy: cornerRadius },
        { cx: size - cornerRadius, cy: cornerRadius },
        { cx: cornerRadius, cy: size - cornerRadius },
        { cx: size - cornerRadius, cy: size - cornerRadius }
      ];

      for (const corner of corners) {
        const inCornerX = (x < cornerRadius && corner.cx < size / 2) || (x >= size - cornerRadius && corner.cx > size / 2);
        const inCornerY = (y < cornerRadius && corner.cy < size / 2) || (y >= size - cornerRadius && corner.cy > size / 2);

        if (inCornerX && inCornerY) {
          const dist = Math.sqrt((x - corner.cx) ** 2 + (y - corner.cy) ** 2);
          if (dist > cornerRadius) {
            alpha = 0;
          }
        }
      }

      // Purple gradient from top-left to bottom-right
      const gradientFactor = (x + y) / (2 * size);
      const r = Math.round(168 - gradientFactor * 44);  // From #a855f7 to #7c3aed
      const g = Math.round(85 - gradientFactor * 27);
      const b = Math.round(247 - gradientFactor * 10);

      rawData.push(r, g, b, alpha);
    }
  }

  // Compress with zlib
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });

  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(compressed.length, 0);
  const idat = Buffer.concat([idatLen, Buffer.from('IDAT'), compressed, idatCrc]);

  // IEND chunk
  const iendCrc = crc32(Buffer.from('IEND'));
  const iend = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('IEND'), iendCrc]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Generate icons
const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  try {
    const png = createPNG(size);
    const filePath = path.join(iconDir, `${size}.png`);
    fs.writeFileSync(filePath, png);
    console.log(`Created ${filePath}`);
  } catch (error) {
    console.error(`Failed to create ${size}x${size} icon:`, error.message);
  }
}

console.log('\nIcon generation complete!');
