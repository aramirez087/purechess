import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MARK_SVG = path.join(__dirname, '../apps/web/public/logo-mark.svg');
const FULL_SVG = path.join(__dirname, '../apps/web/public/logo-full.svg');
const APP_DIR = path.join(__dirname, '../apps/web/src/app');
const STAGE_COLOR = '#0b0d0b';

async function generate() {
  console.log('Generating formats...');

  // 1. icon.png (512x512)
  await sharp(MARK_SVG)
    .resize(512, 512)
    .png()
    .toFile(path.join(APP_DIR, 'icon.png'));
  console.log('✓ icon.png (512x512)');

  // 2. apple-icon.png (180x180, solid background)
  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: STAGE_COLOR
    }
  })
    .composite([
      {
        input: await sharp(MARK_SVG).resize(140, 140).toBuffer(),
        gravity: 'center'
      }
    ])
    .png()
    .toFile(path.join(APP_DIR, 'apple-icon.png'));
  console.log('✓ apple-icon.png (180x180)');

  // 3. opengraph-image.png (1200x630, solid background)
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: STAGE_COLOR
    }
  })
    .composite([
      {
        input: await sharp(FULL_SVG).resize({ width: 800 }).toBuffer(),
        gravity: 'center'
      }
    ])
    .png()
    .toFile(path.join(APP_DIR, 'opengraph-image.png'));
  console.log('✓ opengraph-image.png (1200x630)');

  // 4. favicon.ico
  try {
     const icoBuffer = await sharp(MARK_SVG).resize(32, 32).png().toBuffer();
     await fs.writeFile(path.join(APP_DIR, 'favicon.ico'), icoBuffer);
     console.log('✓ favicon.ico (32x32)');
  } catch (e) {
     console.log('Error generating favicon', e);
  }

  console.log('Done!');
}

generate().catch(console.error);
