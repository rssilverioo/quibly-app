const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const APPSTORE_ICON = path.join(ASSETS_DIR, 'appstore.png');  // 1024x1024
const PLAYSTORE_ICON = path.join(ASSETS_DIR, 'playstore.png'); // 512x512
const BG_DARK = '#0A0A0F';

async function generate() {
  console.log('Mapping high-quality logos to project assets...\n');

  // 1. icon.png (1024x1024) — use appstore.png directly
  await sharp(APPSTORE_ICON)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));
  console.log('✓ icon.png ← appstore.png (1024x1024)');

  // 2. adaptive-icon.png (1024x1024) — playstore icon centered in safe zone
  // Android adaptive icon needs content in center ~66% for safe zone
  const logoForAdaptive = await sharp(PLAYSTORE_ICON)
    .resize(680, 680, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logoForAdaptive, gravity: 'centre' }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png ← playstore.png centered in safe zone (1024x1024)');

  // 3. splash.png (1284x2778) — logo centered on dark background
  const logoForSplash = await sharp(APPSTORE_ICON)
    .resize(480, 480, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 1284,
      height: 2778,
      channels: 4,
      background: BG_DARK,
    },
  })
    .composite([{ input: logoForSplash, gravity: 'centre' }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash.png'));
  console.log('✓ splash.png ← appstore.png on dark bg (1284x2778)');

  // 4. favicon.png (48x48)
  await sharp(PLAYSTORE_ICON)
    .resize(48, 48)
    .png()
    .toFile(path.join(ASSETS_DIR, 'favicon.png'));
  console.log('✓ favicon.png ← playstore.png (48x48)');

  // 5. notification-icon.png (96x96)
  await sharp(PLAYSTORE_ICON)
    .resize(96, 96)
    .png()
    .toFile(path.join(ASSETS_DIR, 'notification-icon.png'));
  console.log('✓ notification-icon.png ← playstore.png (96x96)');

  console.log('\nAll assets mapped successfully!');
}

generate().catch(console.error);
