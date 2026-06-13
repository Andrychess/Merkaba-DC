/**
 * Генерирует PNG/ICO из src/renderer/public/icon.svg для Electron и electron-builder.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'src/renderer/public/icon.svg');
const buildDir = path.join(root, 'build');
const iconsDir = path.join(buildDir, 'icons');
const publicDir = path.join(root, 'src/renderer/public');

const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  const svg = await fs.readFile(svgPath);
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(iconsDir, { recursive: true });

  for (const size of PNG_SIZES) {
    const buffer = await sharp(svg).resize(size, size).png().toBuffer();
    await fs.writeFile(path.join(iconsDir, `${size}x${size}.png`), buffer);
  }

  const icon512 = await sharp(svg).resize(512, 512).png().toBuffer();
  await fs.writeFile(path.join(buildDir, 'icon.png'), icon512);
  await fs.writeFile(path.join(publicDir, 'icon.png'), icon512);

  const icoBuffers = await Promise.all(
    ICO_SIZES.map((size) => sharp(svg).resize(size, size).png().toBuffer())
  );
  const ico = await pngToIco(icoBuffers);
  await fs.writeFile(path.join(buildDir, 'icon.ico'), ico);

  console.log('Icons generated in build/ and src/renderer/public/icon.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
