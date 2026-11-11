/**
 * Render the original Playsz play-button mark into store-required raster sizes.
 * Source: assets/source/icon-mark.svg (first-party; no third-party art).
 *
 * Usage (from app/): node scripts/render-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'assets', 'images');
const BG = '#0B0D12';
const FG = '#6EE7A0';

mkdirSync(outDir, { recursive: true });

/** Full-bleed play mark (used for the 1024 iOS/app icon, flattened, no alpha). */
const fullBleedSvg = (fill, background) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${background}"/>
  <path d="M394 292 L394 732 L762 512 Z" fill="${fill}"/>
</svg>`;

/**
 * Adaptive / monochrome foreground: transparent canvas, triangle kept inside
 * the 66% safe zone so the adaptive mask does not clip it.
 */
const safeZoneSvg = (fill) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <path d="M430 360 L430 664 L710 512 Z" fill="${fill}"/>
</svg>`;

/** Splash logo: play mark only, transparent around it, for the splash plugin. */
const splashSvg = (fill) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <path d="M300 220 L300 804 L820 512 Z" fill="${fill}"/>
</svg>`;

async function writePng(svg, dest, { size, flatten = false, alpha = true }) {
  let pipeline = sharp(Buffer.from(svg)).resize(size, size);
  if (flatten) {
    pipeline = pipeline.flatten({ background: BG });
  }
  if (!alpha) {
    pipeline = pipeline.flatten({ background: BG }).removeAlpha();
  }
  await pipeline.png().toFile(dest);
  const meta = await sharp(dest).metadata();
  console.log(
    `${dest.replace(root + '/', '')}  ${meta.width}x${meta.height}  channels=${meta.channels}  hasAlpha=${meta.hasAlpha}`
  );
}

// Keep a copy of the exact full-bleed source next to the rasters' source folder.
writeFileSync(join(root, 'assets', 'source', 'icon-mark.svg'), fullBleedSvg(FG, BG));

await writePng(fullBleedSvg(FG, BG), join(outDir, 'icon.png'), {
  size: 1024,
  flatten: true,
  alpha: false,
});

await sharp({
  create: { width: 512, height: 512, channels: 3, background: BG },
})
  .png()
  .toFile(join(outDir, 'android-icon-background.png'));
{
  const meta = await sharp(join(outDir, 'android-icon-background.png')).metadata();
  console.log(
    `assets/images/android-icon-background.png  ${meta.width}x${meta.height}  channels=${meta.channels}  hasAlpha=${meta.hasAlpha}`
  );
}

await writePng(safeZoneSvg(FG), join(outDir, 'android-icon-foreground.png'), {
  size: 512,
  alpha: true,
});

await writePng(safeZoneSvg('#FFFFFF'), join(outDir, 'android-icon-monochrome.png'), {
  size: 432,
  alpha: true,
});

await writePng(splashSvg(FG), join(outDir, 'splash-icon.png'), {
  size: 512,
  alpha: true,
});

await writePng(fullBleedSvg(FG, BG), join(outDir, 'favicon.png'), {
  size: 48,
  flatten: true,
  alpha: false,
});

console.log('Rendered original Playsz icons.');
